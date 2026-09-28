const { exec } = require('child_process');
const logger = require('../utils/logger');
const path = require('path');
const { getConnection } = require('../utils/database');
const fs = require('fs');
const { notifyAll } = require('../utils/notifications');
const { buildPythonCommand } = require('../utils/python');
const {
  ensureTdcCalibrationSchema,
  getActiveBaseline,
  getAccessibleProfile,
  readProfileDetails,
  resolvePrintMapping,
  normaliseAdjustment,
  parseJson,
} = require('../services/tdcCalibrationService');

const GENERATED_ROOT = path.resolve(__dirname, '../python/generated');

const buildDownloadUrlFromFilePath = (filePath) => {
  if (!filePath) {
    return null;
  }

  const normalizedRelativePath = path.relative(GENERATED_ROOT, filePath).replace(/\\/g, '/');
  const fileName = path.basename(filePath);

  // If path is outside generated root, fallback to basename route.
  if (!normalizedRelativePath || normalizedRelativePath.startsWith('..')) {
    return `/api/print/download/${fileName}`;
  }

  const topLevelFolder = normalizedRelativePath.split('/')[0];
  if (!topLevelFolder || topLevelFolder === fileName) {
    return `/api/print/download/${fileName}`;
  }

  return `/api/print/download/${topLevelFolder}/${fileName}`;
};

class PrintController {
  // Serve PDF files from any subfolder under generated
  async servePdfFile(req, res) {
    try {
      // req.params[0] contains the wildcard path after /files/pdf/
      const subPath = decodeURIComponent(req.params[0] || '');
      const generatedDir = path.join(__dirname, '../python/generated');
      const filePath = path.join(generatedDir, subPath);

      logger.debug('[PDF DEBUG] Requested subPath:', subPath);
      logger.debug('[PDF DEBUG] Resolved filePath:', filePath);

      if (!subPath) {
        return res.status(400).json({ success: false, error: 'No PDF path specified' });
      }

      if (!fs.existsSync(filePath)) {
        logger.error('[PDF DEBUG] File NOT found on disk:', filePath);
        return res.status(404).json({ success: false, error: 'PDF file not found' });
      }

      // Only allow .pdf files
      if (!subPath.toLowerCase().endsWith('.pdf')) {
        return res.status(403).json({ success: false, error: 'Only PDF files allowed' });
      }
      // Security: ensure filePath is within generatedDir
      if (!filePath.startsWith(generatedDir)) {
        return res.status(403).json({ success: false, error: 'Invalid file path' });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: 'PDF file not found' });
      }
      // Set headers for PDF and allow iframe embedding
      res.setHeader('Content-Type', 'application/pdf');
      res.removeHeader('X-Frame-Options');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(filePath);
    } catch (error) {
      logger.error('Error serving PDF:', error);
      res.status(500).json({ success: false, error: 'Failed to serve PDF' });
    }
  }
  // Add this method inside the PrintController class

  async generatePlainPrint(req, res) {
    try {
      logger.debug('=== GENERATE PLAIN PRINT REQUEST ===');
      const { recordId } = req.body;

      if (!recordId) {
        return res.status(400).json({ success: false, error: 'Record ID is required' });
      }

      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT id, arf_no, owner_name, unirrig_plain_excel_path, unirrig_plain_pdf_path FROM faas_records WHERE id = ?',
        [recordId]
      );

      if (records.length === 0) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      const record = records[0];
      const pythonDir = path.resolve(__dirname, '../python');
      const pythonScript = path.join(pythonDir, 'excel_generator.py');

      // Command for plain UNIRRIG
      const command = buildPythonCommand(
        pythonDir,
        'excel_generator.py',
        `--record-id ${recordId} --type unirrig --plain`
      );
      logger.debug(`ðŸš€ Plain Command: ${command}`);

      exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
        if (error) {
          logger.error('âŒ Python error:', stderr || error.message);
          return res.status(500).json({ success: false, error: 'Failed to generate plain Excel' });
        }

        try {
          let jsonData = null;
          const lines = stdout.split('\n');
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
              jsonData = JSON.parse(trimmedLine);
              break;
            }
          }

          if (jsonData && jsonData.success && jsonData.file_path) {
            const excelPath = jsonData.file_path;

            // Now generate PDF for it
            const pdfDir = path.join(path.dirname(excelPath), 'generated-pdf');
            const pdfFilename = path.basename(excelPath).replace('.xlsx', '.pdf');
            const pdfPath = path.join(pdfDir, pdfFilename);

            if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

            const pdfCommand = buildPythonCommand(
              pythonDir,
              'pdf_converter.py',
              `--excel-path "${excelPath}" --pdf-path "${pdfPath}"`
            );
            logger.debug(`ðŸ“„ Plain PDF Command: ${pdfCommand}`);

            exec(pdfCommand, { cwd: pythonDir }, async (pdfError, pdfStdout, pdfStderr) => {
              if (pdfError) {
                logger.error('âŒ PDF error:', pdfStderr || pdfError.message);
                // Still save the excel even if PDF failed
              }

              // Update DB
              await pool.execute(
                'UPDATE faas_records SET unirrig_plain_excel_path = ?, unirrig_plain_pdf_path = ? WHERE id = ?',
                [excelPath, fs.existsSync(pdfPath) ? pdfPath : null, recordId]
              );

              return res.json({
                success: true,
                message: 'Plain print files generated',
                data: {
                  excelPath: excelPath,
                  pdfPath: pdfPath,
                  excelUrl: `/api/print/download/UNIRRIG/${path.basename(excelPath)}`,
                  pdfUrl: `/api/print/files/pdf/UNIRRIG/generated-pdf/${path.basename(pdfPath)}`
                }
              });
            });
          } else {
            throw new Error('Python did not return valid result');
          }
        } catch (e) {
          logger.error('âŒ Error processing plain print:', e);
          res.status(500).json({ success: false, error: 'Failed to process files' });
        }
      });

    } catch (error) {
      logger.error('âŒ Generate plain print error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async generatePrecisionPrint(req, res) {
    try {
      const { recordId, profileId } = req.body;
      if (!recordId) return res.status(400).json({ success: false, error: 'Record ID is required' });

      const pool = getConnection();
      const pythonDir = path.resolve(__dirname, '../python');

      // Always regenerate UNIRRIG Excel for this record to avoid stale cached data
      // (e.g. old owner names/addresses from previously generated files).
      const regenerateCommand = buildPythonCommand(
        pythonDir,
        'excel_generator.py',
        `--record-id ${recordId} --type unirrig`
      );
      const excelPath = await new Promise((resolve, reject) => {
        exec(regenerateCommand, { cwd: pythonDir }, async (regenError, regenStdout, regenStderr) => {
          if (regenError) {
            return reject(new Error(regenStderr || regenError.message));
          }

          try {
            let jsonData = null;
            const lines = String(regenStdout || '').split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
                jsonData = JSON.parse(trimmedLine);
                break;
              }
            }

            if (!jsonData?.success || !jsonData?.file_path) {
              return reject(new Error('Failed to regenerate UNIRRIG Excel for precision print'));
            }

            await pool.execute(
              'UPDATE faas_records SET unirrig_excel_file_path = ? WHERE id = ?',
              [jsonData.file_path, recordId]
            );

            resolve(jsonData.file_path);
          } catch (parseError) {
            reject(parseError);
          }
        });
      });

      // Resolve a user profile (or the preserved legacy mapping) into a one-off
      // mapping file. The Python renderer stays intentionally unaware of users.
      await ensureTdcCalibrationSchema(pool);
      const resolved = await resolvePrintMapping(pool, req.user, profileId, recordId);
      const os = require('os');
      const mergedPath = path.resolve(os.tmpdir(), `precision_mapping_merged_${recordId}_${Date.now()}.json`);
      fs.writeFileSync(mergedPath, JSON.stringify(resolved.mapping, null, 4));

      const profileSegment = resolved.profile ? `profile_${resolved.profile.id}_r${resolved.profile.profile_revision}` : resolved.source;
      const outputDir = path.resolve(pythonDir, 'generated', 'PRECISION', `record_${recordId}`, profileSegment);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.resolve(outputDir, `TDC_${recordId}_${Date.now()}.pdf`);

      let command = buildPythonCommand(
        pythonDir,
        'precision_pdf_generator.py',
        `--excel-path "${excelPath}" --mapping-file "${mergedPath}" --output-path "${outputPath}"`
      );

      logger.debug(`ðŸš€ Precision Print Command: ${command}`);

      exec(command, { cwd: pythonDir, timeout: 60000, maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
        // Clean up temp merged file
        try { fs.unlinkSync(mergedPath); } catch (e) { /* ignore */ }

        if (error) {
          logger.error('âŒ Precision Error:', error.message);
          return res.status(500).json({ success: false, error: 'PDF generation failed or timed out' });
        }

        try {
          const jsonMatch = stdout.match(/\{"success":.*\}/);
          if (!jsonMatch) throw new Error('Invalid Python output');

          const jsonData = JSON.parse(jsonMatch[0]);

          if (jsonData.success) {
            const [job] = await pool.execute(
              `INSERT INTO tdc_precision_print_jobs
                (record_id, profile_id, profile_revision, generated_by, mapping_snapshot, pdf_path)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [recordId, resolved.profile?.id || null, resolved.profile?.profile_revision || null,
                req.user.id, JSON.stringify(resolved.mapping), jsonData.file_path]
            );

            return res.json({
              success: true,
              data: {
                pdfPath: jsonData.file_path,
                pdfUrl: `/api/print/files/pdf/${path.relative(path.resolve(pythonDir, 'generated'), jsonData.file_path).replace(/\\/g, '/')}`,
                jobId: job.insertId,
                calibrationSource: resolved.source,
                profile: resolved.profile ? {
                  id: resolved.profile.id,
                  name: resolved.profile.name,
                  revision: resolved.profile.profile_revision,
                  verified: Boolean(resolved.profile.is_verified),
                } : null,
              }
            });
          }
          res.status(400).json({ success: false, error: jsonData.error });
        } catch (e) {
          logger.error('âŒ Parsing Error:', e, 'Raw:', stdout);
          res.status(500).json({ success: false, error: 'Failed to process precision file output' });
        }
      });
    } catch (error) {
      logger.error('âŒ Precision print error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getCalibration(req, res) {
    try {
      const { recordId } = req.query;
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const baseline = await getActiveBaseline(pool);
      let fullMapping = baseline.mapping;
      if (recordId) {
        const [legacy] = await pool.execute('SELECT mapping_json FROM tdc_legacy_record_mappings WHERE record_id = ?', [recordId]);
        if (legacy.length) fullMapping = { ...fullMapping, ...parseJson(legacy[0].mapping_json) };
      }
      res.json(fullMapping);
    } catch (error) {
      logger.error('Error reading calibration:', error);
      res.status(500).json({ success: false, error: 'Failed to load calibration' });
    }
  }

  async updateCalibration(req, res) {
    try {
      const { mapping, recordId } = req.body;
      if (!mapping) return res.status(400).json({ success: false, error: 'Mapping data required' });
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      if (recordId) {
        // Compatibility only: legacy content/line overrides remain record-bound.
        await pool.execute(
          `INSERT INTO tdc_legacy_record_mappings (record_id, mapping_json, source_path)
           VALUES (?, ?, 'legacy API') ON DUPLICATE KEY UPDATE mapping_json = VALUES(mapping_json), source_path = VALUES(source_path), imported_at = CURRENT_TIMESTAMP`,
          [recordId, JSON.stringify(mapping)]
        );
      } else {
        if (req.user.role !== 'administrator') return res.status(403).json({ success: false, error: 'Administrator access is required to change the master baseline' });
        const connection = await pool.getConnection();
        try {
          await connection.beginTransaction();
          await connection.execute('UPDATE tdc_layout_baselines SET is_active = 0 WHERE is_active = 1');
          await connection.execute('INSERT INTO tdc_layout_baselines (mapping_json, created_by) VALUES (?, ?)', [JSON.stringify(mapping), req.user.id]);
          await connection.commit();
        } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      }
      res.json({ success: true, message: recordId ? 'Legacy record calibration saved.' : 'New master baseline version saved.' });
    } catch (error) {
      logger.error('Error updating calibration:', error);
      res.status(500).json({ success: false, error: 'Failed to update calibration' });
    }
  }

  // ---------------- TDC calibration profiles ----------------
  async listCalibrationProfiles(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const [rows] = await pool.execute(
        `SELECT p.*, u.full_name AS owner_name, s.default_profile_id
         FROM tdc_calibration_profiles p
         JOIN users u ON u.id = p.owner_user_id
         LEFT JOIN user_tdc_settings s ON s.user_id = ?
         WHERE p.is_archived = 0 AND (p.owner_user_id = ? OR p.visibility = 'published' OR ? = 'administrator')
         ORDER BY (p.owner_user_id = ?) DESC, p.updated_at DESC`,
        [req.user.id, req.user.id, req.user.role, req.user.id]
      );
      res.json(rows.map(row => ({
        ...row,
        is_default: Number(row.default_profile_id) === Number(row.id),
        is_owner: Number(row.owner_user_id) === Number(req.user.id),
      })));
    } catch (error) {
      logger.error('Error listing TDC calibration profiles:', error);
      res.status(500).json({ success: false, error: 'Failed to load calibration profiles' });
    }
  }

  async createCalibrationProfile(req, res) {
    try {
      const { name, printerName, paperBatch, formRevision = 'TDC-8x11-v1', makeDefault = true } = req.body;
      if (![name, printerName, paperBatch].every(value => String(value || '').trim())) {
        return res.status(400).json({ success: false, error: 'Profile name, printer name, and paper batch are required' });
      }
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const baseline = await getActiveBaseline(pool);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [created] = await connection.execute(
          `INSERT INTO tdc_calibration_profiles (owner_user_id, baseline_id, name, printer_name, paper_batch, form_revision)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.user.id, baseline.id, String(name).trim(), String(printerName).trim(), String(paperBatch).trim(), String(formRevision).trim()]
        );
        for (const page of [1, 2]) await connection.execute('INSERT INTO tdc_profile_page_adjustments (profile_id, page_number) VALUES (?, ?)', [created.insertId, page]);
        if (makeDefault) {
          await connection.execute(
            `INSERT INTO user_tdc_settings (user_id, default_profile_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE default_profile_id = VALUES(default_profile_id)`,
            [req.user.id, created.insertId]
          );
        }
        await connection.commit();
        const profile = await getAccessibleProfile(pool, created.insertId, req.user);
        res.status(201).json(await readProfileDetails(pool, profile));
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally { connection.release(); }
    } catch (error) {
      logger.error('Error creating TDC calibration profile:', error);
      res.status(500).json({ success: false, error: 'Failed to create calibration profile' });
    }
  }

  async getCalibrationProfile(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user);
      if (!profile) return res.status(404).json({ success: false, error: 'Calibration profile not found' });
      res.json(await readProfileDetails(pool, profile));
    } catch (error) {
      logger.error('Error reading TDC calibration profile:', error);
      res.status(500).json({ success: false, error: 'Failed to load calibration profile' });
    }
  }

  async updateCalibrationProfile(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user, true);
      if (!profile) return res.status(403).json({ success: false, error: 'You cannot edit this calibration profile' });
      const { name, printerName, paperBatch, isVerified } = req.body;
      await pool.execute(
        `UPDATE tdc_calibration_profiles
         SET name = COALESCE(?, name), printer_name = COALESCE(?, printer_name), paper_batch = COALESCE(?, paper_batch),
             is_verified = COALESCE(?, is_verified), profile_revision = profile_revision + 1
         WHERE id = ?`,
        [name === undefined ? null : String(name).trim(), printerName === undefined ? null : String(printerName).trim(),
          paperBatch === undefined ? null : String(paperBatch).trim(), isVerified === undefined ? null : Boolean(isVerified), profile.id]
      );
      res.json(await readProfileDetails(pool, await getAccessibleProfile(pool, profile.id, req.user)));
    } catch (error) {
      logger.error('Error updating TDC calibration profile:', error);
      res.status(500).json({ success: false, error: 'Failed to update calibration profile' });
    }
  }

  async updateCalibrationAdjustments(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user, true);
      if (!profile) return res.status(403).json({ success: false, error: 'You cannot edit this calibration profile' });
      const adjustments = Array.isArray(req.body.adjustments) ? req.body.adjustments : [];
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const item of adjustments) {
          const page = Number(item.pageNumber);
          if (![1, 2].includes(page)) continue;
          const adjustment = normaliseAdjustment(item);
          await connection.execute(
            `INSERT INTO tdc_profile_page_adjustments
              (profile_id, page_number, offset_x_mm, offset_y_mm, scale_x, scale_y, rotation_deg)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE offset_x_mm = VALUES(offset_x_mm), offset_y_mm = VALUES(offset_y_mm),
                scale_x = VALUES(scale_x), scale_y = VALUES(scale_y), rotation_deg = VALUES(rotation_deg)`,
            [profile.id, page, adjustment.offsetXmm, adjustment.offsetYmm, adjustment.scaleX, adjustment.scaleY, adjustment.rotationDeg]
          );
        }
        await connection.execute('UPDATE tdc_calibration_profiles SET is_verified = 0, profile_revision = profile_revision + 1 WHERE id = ?', [profile.id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      res.json(await readProfileDetails(pool, await getAccessibleProfile(pool, profile.id, req.user)));
    } catch (error) {
      logger.error('Error updating TDC adjustments:', error);
      res.status(500).json({ success: false, error: 'Failed to update page calibration' });
    }
  }

  async updateCalibrationOverrides(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user, true);
      if (!profile) return res.status(403).json({ success: false, error: 'You cannot edit this calibration profile' });
      const overrides = Array.isArray(req.body.overrides) ? req.body.overrides : [];
      const baselineRows = await pool.execute('SELECT mapping_json FROM tdc_layout_baselines WHERE id = ?', [profile.baseline_id]);
      const baseline = parseJson(baselineRows[0][0]?.mapping_json);
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const override of overrides) {
          if (!baseline[override.fieldKey]) continue;
          const deltaXmm = Math.max(-25, Math.min(25, Number(override.deltaXmm) || 0));
          const deltaYmm = Math.max(-25, Math.min(25, Number(override.deltaYmm) || 0));
          const fontDeltaPt = Math.max(-6, Math.min(6, Number(override.fontDeltaPt) || 0));
          if (!deltaXmm && !deltaYmm && !fontDeltaPt) {
            await connection.execute('DELETE FROM tdc_profile_field_overrides WHERE profile_id = ? AND field_key = ?', [profile.id, override.fieldKey]);
          } else {
            await connection.execute(
              `INSERT INTO tdc_profile_field_overrides (profile_id, field_key, delta_x_mm, delta_y_mm, font_delta_pt)
               VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE delta_x_mm = VALUES(delta_x_mm), delta_y_mm = VALUES(delta_y_mm), font_delta_pt = VALUES(font_delta_pt)`,
              [profile.id, override.fieldKey, deltaXmm, deltaYmm, fontDeltaPt]
            );
          }
        }
        await connection.execute('UPDATE tdc_calibration_profiles SET is_verified = 0, profile_revision = profile_revision + 1 WHERE id = ?', [profile.id]);
        await connection.commit();
      } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
      res.json(await readProfileDetails(pool, await getAccessibleProfile(pool, profile.id, req.user)));
    } catch (error) {
      logger.error('Error updating TDC field overrides:', error);
      res.status(500).json({ success: false, error: 'Failed to update field overrides' });
    }
  }

  async setDefaultCalibrationProfile(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user);
      if (!profile) return res.status(404).json({ success: false, error: 'Calibration profile not found' });
      await pool.execute(
        `INSERT INTO user_tdc_settings (user_id, default_profile_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE default_profile_id = VALUES(default_profile_id)`, [req.user.id, profile.id]
      );
      res.json({ success: true, defaultProfileId: profile.id });
    } catch (error) {
      logger.error('Error selecting default TDC profile:', error);
      res.status(500).json({ success: false, error: 'Failed to select calibration profile' });
    }
  }

  async publishCalibrationProfile(req, res) {
    try {
      if (req.user.role !== 'administrator') return res.status(403).json({ success: false, error: 'Administrator access is required' });
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user);
      if (!profile) return res.status(404).json({ success: false, error: 'Calibration profile not found' });
      const visibility = req.body.published ? 'published' : 'private';
      await pool.execute('UPDATE tdc_calibration_profiles SET visibility = ?, published_by = ?, profile_revision = profile_revision + 1 WHERE id = ?', [visibility, visibility === 'published' ? req.user.id : null, profile.id]);
      res.json(await readProfileDetails(pool, await getAccessibleProfile(pool, profile.id, req.user)));
    } catch (error) {
      logger.error('Error publishing TDC profile:', error);
      res.status(500).json({ success: false, error: 'Failed to publish calibration profile' });
    }
  }

  async archiveCalibrationProfile(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user, true);
      if (!profile) return res.status(403).json({ success: false, error: 'You cannot archive this calibration profile' });
      await pool.execute('UPDATE tdc_calibration_profiles SET is_archived = 1 WHERE id = ?', [profile.id]);
      res.json({ success: true });
    } catch (error) {
      logger.error('Error archiving TDC profile:', error);
      res.status(500).json({ success: false, error: 'Failed to archive calibration profile' });
    }
  }

  async getCalibrationProfileFields(req, res) {
    try {
      const pool = getConnection();
      await ensureTdcCalibrationSchema(pool);
      const profile = await getAccessibleProfile(pool, req.params.id, req.user);
      if (!profile) return res.status(404).json({ success: false, error: 'Calibration profile not found' });
      const details = await readProfileDetails(pool, profile);
      const [baselineRows] = await pool.execute('SELECT mapping_json FROM tdc_layout_baselines WHERE id = ?', [profile.baseline_id]);
      const baseline = parseJson(baselineRows[0]?.mapping_json);
      const overrideByKey = Object.fromEntries(details.fieldOverrides.map(item => [item.fieldKey, item]));
      res.json(Object.entries(baseline).map(([fieldKey, field]) => ({
        fieldKey, label: field.label || fieldKey, pageNumber: fieldKey.startsWith('Sheet2!') ? 2 : 1,
        ...(overrideByKey[fieldKey] || { deltaXmm: 0, deltaYmm: 0, fontDeltaPt: 0 }),
      })));
    } catch (error) {
      logger.error('Error loading TDC profile fields:', error);
      res.status(500).json({ success: false, error: 'Failed to load calibration fields' });
    }
  }

  async generateCalibrationTest(req, res) {
    try {
      const pool = getConnection();
      const profileId = req.body.profileId;
      if (!profileId) return res.status(400).json({ success: false, error: 'Choose a calibration profile first' });
      const resolved = await resolvePrintMapping(pool, req.user, profileId, 0, req.body.adjustments);
      const pythonDir = path.resolve(__dirname, '../python');
      const os = require('os');
      const mappingPath = path.resolve(os.tmpdir(), `tdc_test_mapping_${req.user.id}_${Date.now()}.json`);
      const outputDir = path.resolve(pythonDir, 'generated', 'CALIBRATION');
      const outputPath = path.resolve(outputDir, `TDC_alignment_test_${req.user.id}_${Date.now()}.pdf`);
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(mappingPath, JSON.stringify(resolved.mapping));
      const command = buildPythonCommand(pythonDir, 'tdc_calibration_test_generator.py', `--mapping-file "${mappingPath}" --output-path "${outputPath}"`);
      exec(command, { cwd: pythonDir, timeout: 30000 }, (error, stdout, stderr) => {
        try { fs.unlinkSync(mappingPath); } catch { /* no-op */ }
        if (error) {
          logger.error('TDC calibration test failed:', stderr || error.message);
          return res.status(500).json({ success: false, error: 'Failed to generate calibration test' });
        }
        return res.json({ success: true, data: { pdfPath: outputPath, pdfUrl: `/api/print/files/pdf/CALIBRATION/${path.basename(outputPath)}` } });
      });
    } catch (error) {
      logger.error('Error generating TDC calibration test:', error);
      res.status(error.status || 500).json({ success: false, error: error.message || 'Failed to generate calibration test' });
    }
  }

  async clearGeneratedFiles(recordId) {
    try {
      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT excel_file_path, unirrig_excel_file_path, pdf_preview_path, unirrig_pdf_preview_path, unirrig_plain_excel_path, unirrig_plain_pdf_path, unirrig_precision_pdf_path FROM faas_records WHERE id = ?',
        [recordId]
      );

      if (records.length === 0) return;

      const record = records[0];

      const filesToDelete = [
        record.excel_file_path,
        record.unirrig_excel_file_path,
        record.pdf_preview_path,
        record.unirrig_pdf_preview_path,
        record.unirrig_plain_excel_path,
        record.unirrig_plain_pdf_path,
        record.unirrig_precision_pdf_path
      ];

      filesToDelete.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.debug(`ðŸ—‘ï¸ Deleted on cleanup: ${filePath}`);
          } catch (e) {
            logger.error(`âš ï¸ Could not delete file: ${filePath} â€” ${e.message}`);
          }
        }
      });

      // Clear paths in DB
      await pool.execute(
        `UPDATE faas_records 
        SET excel_file_path = NULL, unirrig_excel_file_path = NULL, 
            pdf_preview_path = NULL, unirrig_pdf_preview_path = NULL,
            unirrig_plain_excel_path = NULL, unirrig_plain_pdf_path = NULL,
            unirrig_precision_pdf_path = NULL
        WHERE id = ?`,
        [recordId]
      );

      logger.debug(`âœ… Cleared generated files for record ${recordId}`);
    } catch (e) {
      logger.error(`âŒ clearGeneratedFiles error: ${e.message}`);
    }
  }
  async generateFAASExcel(req, res) {
    try {
      logger.debug('=== GENERATE EXCEL REQUEST ===');
      const { recordId } = req.body;

      if (!recordId) {
        return res.status(400).json({
          success: false,
          error: 'Record ID is required'
        });
      }

      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT id, arf_no, owner_name, excel_file_path, unirrig_excel_file_path, pdf_preview_path, unirrig_pdf_preview_path FROM faas_records WHERE id = ? AND hidden = 0',
        [recordId]
      );
      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'FAAS record not found'
        });
      }

      const record = records[0];
      logger.debug(`ðŸ“Š Generating Excel for: ${record.arf_no}`);

      // Auto-cleanup: Delete previous preview files if they exist to save space
      const filesToDelete = [
        record.excel_file_path,
        record.unirrig_excel_file_path,
        record.pdf_preview_path,
        record.unirrig_pdf_preview_path
      ];

      filesToDelete.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            logger.debug(`ðŸ§¹ Deleted old preview file: ${path.basename(filePath)}`);
          } catch (err) {
            logger.warn(`âš ï¸ Could not delete old preview file ${filePath}:`, err.message);
          }
        }
      });

      const pythonDir = path.resolve(__dirname, '../python');
      const pythonScript = path.join(pythonDir, 'excel_generator.py');

      if (!fs.existsSync(pythonScript)) {
        return res.status(500).json({
          success: false,
          error: 'Python script not found'
        });
      }

      const generatedDir = path.join(pythonDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      const command = buildPythonCommand(
        pythonDir,
        'excel_generator.py',
        `--record-id ${recordId} --type both`
      );
      logger.debug(`ðŸš€ Command: ${command}`);

      exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
        logger.debug('ðŸ Python output:', stdout);

        if (error) {
          logger.error('âŒ Python error:', stderr || error.message);
          return res.status(500).json({
            success: false,
            error: 'Failed to generate Excel',
            details: stderr || error.message
          });
        }

        try {
          let jsonData = null;
          const lines = stdout.split('\n');
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
              try {
                jsonData = JSON.parse(trimmedLine);
                break;
              } catch (e) {
                // Not JSON, continue
              }
            }
          }

          if (jsonData && (jsonData.success || (jsonData.faas && jsonData.faas.success))) {
            const faasPath = jsonData.faas ? jsonData.faas.file_path : null;
            const unirrigPath = jsonData.unirrig ? jsonData.unirrig.file_path : null;

            // Generate PDFs for preview
            const pdfFiles = [];
            const generatePdf = (excelPath, type) => {
              if (!excelPath || !fs.existsSync(excelPath)) return Promise.resolve(null);

              const pdfDir = path.join(path.dirname(excelPath), 'generated-pdf');
              if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

              const pdfFilename = path.basename(excelPath).replace('.xlsx', '.pdf');
              const pdfPath = path.join(pdfDir, pdfFilename);

              const pdfCommand = buildPythonCommand(
                pythonDir,
                'pdf_converter.py',
                `--excel-path "${excelPath}" --pdf-path "${pdfPath}"`
              );
              logger.debug(`ðŸ“„ Generating PDF Preview [${type}]: ${pdfCommand}`);

              return new Promise((resolve) => {
                exec(pdfCommand, { cwd: pythonDir }, (pdfError, pdfStdout, pdfStderr) => {
                  if (pdfError) {
                    logger.error(`âŒ PDF error [${type}]:`, pdfStderr || pdfError.message);
                    resolve(null);
                  } else {
                    resolve(fs.existsSync(pdfPath) ? pdfPath : null);
                  }
                });
              });
            };

            const [faasPdfPath, unirrigPdfPath] = await Promise.all([
              generatePdf(faasPath, 'FAAS'),
              generatePdf(unirrigPath, 'UNIRRIG')
            ]);

            // Update DB with Excel and PDF paths
            await pool.execute(
              'UPDATE faas_records SET excel_file_path = ?, unirrig_excel_file_path = ?, pdf_preview_path = ?, unirrig_pdf_preview_path = ? WHERE id = ?',
              [faasPath, unirrigPath, faasPdfPath, unirrigPdfPath, recordId]
            );

            return res.json({
              success: true,
              message: 'Excel and PDF previews generated successfully',
              data: {
                faas: jsonData.faas ? {
                  filePath: faasPath,
                  fileName: jsonData.faas.file_name,
                  downloadUrl: `/api/print/download/FAAS/${jsonData.faas.file_name}`,
                  pdfUrl: faasPdfPath ? `/api/print/files/pdf/FAAS/generated-pdf/${path.basename(faasPdfPath)}` : null
                } : null,
                unirrig: jsonData.unirrig ? {
                  filePath: unirrigPath,
                  fileName: jsonData.unirrig.file_name,
                  downloadUrl: `/api/print/download/UNIRRIG/${jsonData.unirrig.file_name}`,
                  pdfUrl: unirrigPdfPath ? `/api/print/files/pdf/UNIRRIG/generated-pdf/${path.basename(unirrigPdfPath)}` : null
                } : null,
                recordId: recordId,
                arfNo: record.arf_no
              }
            });
          } else {
            throw new Error('Python script did not return success status');
          }
        } catch (parseError) {
          logger.error('âŒ Parse error:', parseError);
          return res.status(500).json({
            success: false,
            error: 'Failed to process Python output',
            output: stdout.substring(0, 200)
          });
        }
      });

    } catch (error) {
      logger.error('âŒ Generate Excel error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async executePythonScript(pythonCommand, pythonDir, recordId, record, res) {
    logger.debug(`ðŸš€ Using Python command: ${pythonCommand}`);

    // Build command - change to python directory first
    const command = `cd "${pythonDir}" && ${pythonCommand} excel_generator.py --record-id ${recordId}`;
    logger.debug(`ðŸ”§ Command: ${command}`);

    exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
      logger.debug('=== PYTHON EXECUTION OUTPUT ===');
      logger.debug('stdout:', stdout);
      logger.debug('stderr:', stderr);
      logger.debug('error:', error);
      logger.debug('===============================');

      if (error) {
        logger.error('âŒ Python execution failed:', error);
        return res.status(500).json({
          success: false,
          error: 'Python script execution failed',
          details: stderr || error.message
        });
      }

      // Check if Python printed success
      if (stdout.includes('"success": true') || stdout.includes('âœ… Success!')) {
        try {
          // Parse JSON output
          const lines = stdout.split('\n');
          let jsonData = null;

          for (const line of lines) {
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              try {
                jsonData = JSON.parse(line.trim());
                logger.debug('âœ… Parsed JSON output:', jsonData);
                break;
              } catch (e) {
                // Not valid JSON, continue
              }
            }
          }

          if (!jsonData && stdout.includes('File:') && stdout.includes('Path:')) {
            // Fallback: Parse from text output
            const fileLine = lines.find(line => line.includes('Path:'));
            if (fileLine) {
              const filePath = fileLine.split('Path:')[1].trim();
              jsonData = {
                success: true,
                file_path: filePath,
                file_name: path.basename(filePath)
              };
            }
          }

          if (!jsonData || !jsonData.file_path) {
            throw new Error('Could not parse Python output');
          }

          // Verify file exists
          if (!fs.existsSync(jsonData.file_path)) {
            logger.error('âŒ Generated file not found at:', jsonData.file_path);
            throw new Error('Generated file does not exist');
          }

          logger.debug('âœ… File verified at:', jsonData.file_path);

          // Update database
          const pool = getConnection();
          await pool.execute(
            'UPDATE faas_records SET excel_file_path = ? WHERE id = ?',
            [jsonData.file_path, recordId]
          );

          res.json({
            success: true,
            message: 'Excel file generated successfully',
            data: {
              filePath: jsonData.file_path,
              fileName: jsonData.file_name || path.basename(jsonData.file_path),
              downloadUrl: buildDownloadUrlFromFilePath(jsonData.file_path),
              recordId: recordId,
              arfNo: record.arf_no
            }
          });

        } catch (parseError) {
          logger.error('âŒ Parse error:', parseError);
          logger.error('Raw stdout:', stdout);
          res.status(500).json({
            success: false,
            error: 'Failed to process Python output',
            details: parseError.message,
            stdout: stdout.substring(0, 500) // First 500 chars
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Python script did not indicate success',
          stdout: stdout,
          stderr: stderr
        });
      }
    });
  }

  async downloadFile(req, res) {
    try {
      const { folder, filename: paramFilename } = req.params;
      const rawParam = req.params[0] || req.params.filename || paramFilename || '';
      const filename = decodeURIComponent(rawParam);

      const generatedDir = path.resolve(__dirname, '../python/generated');
      const isInsideGeneratedDir = (targetPath) => {
        const normalizedTarget = path.resolve(targetPath);
        return normalizedTarget === generatedDir || normalizedTarget.startsWith(`${generatedDir}${path.sep}`);
      };

      let filePath;

      if (folder && paramFilename) {
        filePath = path.resolve(generatedDir, folder, paramFilename);
      } else {
        filePath = path.resolve(generatedDir, filename);
      }

      // Security: block traversal before any disk operations
      if (!isInsideGeneratedDir(filePath)) {
        return res.status(403).json({ success: false, error: 'Invalid file path' });
      }

      logger.debug('ðŸ“¥ DOWNLOAD DEBUG:');
      logger.debug(`- Folder: ${folder}, ParamFilename: ${paramFilename}`);
      logger.debug(`- Raw param: ${rawParam}`);
      logger.debug(`- Final FilePath: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        // Fallback for legacy URLs that only include basename but file lives in nested subfolders
        const requestedBaseName = path.basename(paramFilename || filename || '');
        const searchRoot = folder
          ? path.resolve(generatedDir, folder)
          : generatedDir;

        if (requestedBaseName && isInsideGeneratedDir(searchRoot) && fs.existsSync(searchRoot)) {
          const stack = [searchRoot];
          let foundPath = null;

          while (stack.length > 0 && !foundPath) {
            const currentDir = stack.pop();
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const entry of entries) {
              const fullPath = path.join(currentDir, entry.name);
              if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
              }

              if (entry.isFile() && entry.name === requestedBaseName) {
                foundPath = fullPath;
                break;
              }
            }
          }

          if (foundPath) {
            filePath = foundPath;
            logger.debug(`- Fallback matched nested file: ${filePath}`);
          }
        }

        if (!fs.existsSync(filePath)) {
          logger.error('âŒ File not found:', filePath);
          // List directory to help debug
          const subDir = filename.includes('/') ? path.dirname(filename) : '';
          const searchDir = path.join(generatedDir, subDir);
          if (fs.existsSync(searchDir)) {
            logger.debug(`- Directory ${searchDir} exists. Contents:`, fs.readdirSync(searchDir));
          } else {
            logger.debug(`- Directory ${searchDir} does NOT exist.`);
          }

          return res.status(404).json({ success: false, error: 'File not found' });
        }
      }

      // Security: ensure filePath is within generatedDir
      if (!isInsideGeneratedDir(filePath)) {
        return res.status(403).json({ success: false, error: 'Invalid file path' });
      }

      logger.debug('âœ… File found, sending download...');

      // Pass only the basename as the second argument (the name the user sees)
      const downloadName = path.basename(filename);
      res.download(filePath, downloadName, (err) => {
        if (err) {
          logger.error('âŒ Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Failed to download file'
            });
          }
        } else {
          logger.debug('âœ… Download sent successfully');
        }
      });

    } catch (error) {
      logger.error('âŒ Download error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getGeneratedFiles(req, res) {
    try {
      const { recordId } = req.params;

      const pool = getConnection();
      const [rows] = await pool.execute(`
        SELECT 
          excel_file_path,
          arf_no,
          owner_name,
          status
        FROM faas_records 
        WHERE id = ?
      `, [recordId]);

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found'
        });
      }

      const record = rows[0];
      const files = [];

      if (record.excel_file_path && fs.existsSync(record.excel_file_path)) {
        files.push({
          type: 'excel',
          path: record.excel_file_path,
          name: path.basename(record.excel_file_path),
          downloadUrl: buildDownloadUrlFromFilePath(record.excel_file_path)
        });
      }

      res.json({
        success: true,
        data: {
          files: files,
          record: {
            arfNo: record.arf_no,
            ownerName: record.owner_name,
            status: record.status
          }
        }
      });

    } catch (error) {
      logger.error('Get files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getApprovedRecords(req, res) {
    try {
      logger.debug('ðŸ“‹ Getting approved records...');

      const pool = getConnection();
      const [records] = await pool.execute(`
      SELECT 
        f.*,
        f.id,
        f.arf_no,
        f.pin,
        f.owner_name,
        f.property_location,
        f.classification,
        f.market_value,
        f.assessed_value,
        f.created_at,
        f.approval_date as approved_at,
        ue.full_name as encoder_name,
        ue.profile_picture as encoder_profile_picture,
        ua.full_name as approver_name,
        f.status
      FROM faas_records f
      LEFT JOIN users ue ON f.encoder_id = ue.id
      LEFT JOIN users ua ON f.approver_id = ua.id
      WHERE f.status = 'approved'
        AND f.hidden = 0
        AND f.released_at IS NULL
      ORDER BY f.approval_date DESC
    `);

      logger.debug(`âœ… Found ${records.length} approved records`);

      res.json(records);

    } catch (error) {
      logger.error('âŒ Get approved records error:', error);
      logger.error('âŒ SQL Error details:', {
        code: error.code,
        message: error.message,
        sql: error.sql,
        sqlMessage: error.sqlMessage
      });

      // Return proper error response
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approved records',
        details: error.message
      });
    }
  }

  async releaseRecord(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Record ID is required' });
      }

      logger.debug(`ðŸ“¦ Releasing record ${id} by user ${userId}`);

      const pool = getConnection();

      // Update the record with release info
      const [result] = await pool.execute(`
        UPDATE faas_records 
        SET 
          released_at = NOW(),
          released_by = ?,
          updated_at = NOW()
        WHERE id = ? AND status = 'approved' AND released_at IS NULL
      `, [userId, id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found, not approved, or already released'
        });
      }

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, 'RELEASE', 'faas_records', ?, 'Marked record as released/printed')
      `, [userId, id]);

      res.json({
        success: true,
        message: 'Record marked as released successfully'
      });

    } catch (error) {
      logger.error('âŒ Release record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to release record'
      });
    }
  }

  async cancelRelease(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      if (!id) {
        return res.status(400).json({ success: false, error: 'Record ID is required' });
      }

      logger.debug(`â†©ï¸ Cancelling release for record ${id} by user ${userId}`);

      const pool = getConnection();

      // Update the record: clear release info
      const [result] = await pool.execute(`
        UPDATE faas_records 
        SET 
          released_at = NULL,
          released_by = NULL,
          updated_at = NOW()
        WHERE id = ? AND status = 'approved' AND released_at IS NOT NULL
      `, [id]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          error: 'Record not found or is not currently released'
        });
      }

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, 'CANCEL_RELEASE', 'faas_records', ?, 'Cancelled release of record (reverted to print preview)')
      `, [userId, id]);

      res.json({
        success: true,
        message: 'Release cancelled successfully. Record is now back in Print Preview.'
      });

    } catch (error) {
      logger.error('âŒ Cancel release error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel release'
      });
    }
  }

  async getReleasedRecords(req, res) {
    try {
      logger.debug('ðŸ“œ Getting released records history...');

      const pool = getConnection();
      const [records] = await pool.execute(`
        SELECT 
          f.id,
          f.arf_no,
          f.pin,
          f.owner_name,
          f.property_location,
          f.classification,
          f.market_value,
          f.assessed_value,
          f.created_at,
          f.approval_date as approved_at,
          f.released_at,
          f.excel_file_path,
          f.unirrig_excel_file_path,
          f.pdf_preview_path,
          f.unirrig_pdf_preview_path,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name,
          ur.full_name as released_by_name,
          f.status
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        LEFT JOIN users ur ON f.released_by = ur.id
        WHERE f.status = 'approved'
          AND f.hidden = 0
          AND f.released_at IS NOT NULL
        ORDER BY f.released_at DESC
      `);

      res.json(records);

    } catch (error) {
      logger.error('âŒ Get released records error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch released records history'
      });
    }
  }
}

module.exports = new PrintController();

