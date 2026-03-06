const { exec } = require('child_process');
const path = require('path');
const { getConnection } = require('../utils/database');
const fs = require('fs');

class PrintController {
  // Serve PDF files from any subfolder under generated
  async servePdfFile(req, res) {
    try {
      // req.params[0] contains the wildcard path after /files/pdf/
      const subPath = decodeURIComponent(req.params[0] || '');
      const generatedDir = path.join(__dirname, '../python/generated');
      const filePath = path.join(generatedDir, subPath);

      console.log('[PDF DEBUG] Requested subPath:', subPath);
      console.log('[PDF DEBUG] Resolved filePath:', filePath);

      if (!subPath) {
        return res.status(400).json({ success: false, error: 'No PDF path specified' });
      }

      if (!fs.existsSync(filePath)) {
        console.error('[PDF DEBUG] File NOT found on disk:', filePath);
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
      console.error('Error serving PDF:', error);
      res.status(500).json({ success: false, error: 'Failed to serve PDF' });
    }
  }
  // Add this method inside the PrintController class

  async generatePlainPrint(req, res) {
    try {
      console.log('=== GENERATE PLAIN PRINT REQUEST ===');
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
      const command = `cd "${pythonDir}" && python excel_generator.py --record-id ${recordId} --type unirrig --plain`;
      console.log(`🚀 Plain Command: ${command}`);

      exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Python error:', stderr || error.message);
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

            const pdfCommand = `cd "${pythonDir}" && python pdf_converter.py --excel-path "${excelPath}" --pdf-path "${pdfPath}"`;
            console.log(`📄 Plain PDF Command: ${pdfCommand}`);

            exec(pdfCommand, { cwd: pythonDir }, async (pdfError, pdfStdout, pdfStderr) => {
              if (pdfError) {
                console.error('❌ PDF error:', pdfStderr || pdfError.message);
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
          console.error('❌ Error processing plain print:', e);
          res.status(500).json({ success: false, error: 'Failed to process files' });
        }
      });

    } catch (error) {
      console.error('❌ Generate plain print error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async generatePrecisionPrint(req, res) {
    try {
      const { recordId, blank } = req.body;
      if (!recordId) return res.status(400).json({ success: false, error: 'Record ID is required' });

      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT unirrig_excel_file_path FROM faas_records WHERE id = ?',
        [recordId]
      );

      if (!records || records.length === 0 || !records[0].unirrig_excel_file_path) {
        return res.status(404).json({ success: false, error: 'Excel file path not found in database' });
      }

      const excelPath = records[0].unirrig_excel_file_path;
      const pythonDir = path.resolve(__dirname, '../python');

      // Priority: 1. Record-specific mapping, 2. Global Template mapping
      const specificMappingPath = path.resolve(pythonDir, `precision_mapping_${recordId}.json`);
      const templateMappingPath = path.resolve(pythonDir, `precision_mapping.json`);
      const backgroundPdfPath = path.resolve(pythonDir, 'tax_dec.pdf');

      let command = `python precision_pdf_generator.py --excel-path "${excelPath}"`;

      if (fs.existsSync(specificMappingPath)) {
        command += ` --mapping-file "precision_mapping_${recordId}.json"`;
      } else if (fs.existsSync(templateMappingPath)) {
        command += ` --mapping-file "precision_mapping.json"`;
      }

      // 🖼️ Background: only if it exists AND we are NOT requesting a blank version
      if (fs.existsSync(backgroundPdfPath) && !blank) {
        command += ' --template-pdf "tax_dec.pdf"';
      }

      // 🏷️ Output: differentiate white-paper (blank) version from preview
      if (blank) {
        const outDir = path.join(pythonDir, "generated", "PRECISION");
        const outFilename = `Precision_BLANK_${path.basename(excelPath).replace('.xlsx', '.pdf')}`;
        command += ` --output "${path.join(outDir, outFilename)}"`;
      }

      console.log(`🚀 Precision Print Command: ${command}`);

      exec(command, { cwd: pythonDir, timeout: 60000, maxBuffer: 1024 * 1024 * 10 }, async (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Precision Error:', error.message);
          return res.status(500).json({ success: false, error: 'PDF generation failed or timed out' });
        }

        try {
          const jsonMatch = stdout.match(/\{"success":.*\}/);
          if (!jsonMatch) throw new Error('Invalid Python output');

          const jsonData = JSON.parse(jsonMatch[0]);

          if (jsonData.success) {
            const pool = getConnection();
            await pool.execute(
              'UPDATE faas_records SET unirrig_precision_pdf_path = ? WHERE id = ?',
              [jsonData.file_path, recordId]
            );

            return res.json({
              success: true,
              data: {
                pdfPath: jsonData.file_path,
                pdfUrl: `/api/print/files/pdf/PRECISION/${jsonData.file_name}`
              }
            });
          }
          res.status(400).json({ success: false, error: jsonData.error });
        } catch (e) {
          console.error('❌ Parsing Error:', e, 'Raw:', stdout);
          res.status(500).json({ success: false, error: 'Failed to process precision file output' });
        }
      });
    } catch (error) {
      console.error('❌ Precision print error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getCalibration(req, res) {
    try {
      const { recordId } = req.query;
      const pythonDir = path.resolve(__dirname, '../python');

      // 1. Always start with the Master Template
      let fullMapping = {};
      const configPath = path.resolve(pythonDir, 'precision_mapping.json');
      if (fs.existsSync(configPath)) {
        fullMapping = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      // 2. Overwrite with record-specific data if it exists
      if (recordId) {
        const specificPath = path.resolve(pythonDir, `precision_mapping_${recordId}.json`);
        if (fs.existsSync(specificPath)) {
          const specificData = JSON.parse(fs.readFileSync(specificPath, 'utf8'));
          // Merge specific values into the master map
          fullMapping = { ...fullMapping, ...specificData };
        }
      }

      res.json(fullMapping);
    } catch (error) {
      console.error('Error reading calibration:', error);
      res.status(500).json({ success: false, error: 'Failed to load calibration' });
    }
  }

  async updateCalibration(req, res) {
    try {
      const { mapping, recordId } = req.body;
      if (!mapping) return res.status(400).json({ success: false, error: 'Mapping data required' });

      // Save as record-specific calibration if recordId is provided
      const pythonDir = path.resolve(__dirname, '../python');
      const filename = recordId ? `precision_mapping_${recordId}.json` : 'precision_mapping.json';
      const configPath = path.resolve(pythonDir, filename);

      fs.writeFileSync(configPath, JSON.stringify(mapping, null, 4));

      // NEW FLOW: If we are calibrating a specific record, DELETE its existing Precision PDF
      if (recordId) {
        const pool = getConnection();
        const [rows] = await pool.execute('SELECT unirrig_precision_pdf_path FROM faas_records WHERE id = ?', [recordId]);

        if (rows.length > 0 && rows[0].unirrig_precision_pdf_path) {
          const oldPdfPath = rows[0].unirrig_precision_pdf_path;
          if (fs.existsSync(oldPdfPath)) {
            try { fs.unlinkSync(oldPdfPath); } catch (e) { console.error('Failed to delete old precision pdf:', e); }
          }
          // Clear current path in DB so UI shows it's gone
          await pool.execute('UPDATE faas_records SET unirrig_precision_pdf_path = NULL WHERE id = ?', [recordId]);
        }
      }

      res.json({ success: true, message: 'Calibration saved. Previous PDF deleted.' });
    } catch (error) {
      console.error('Error updating calibration:', error);
      res.status(500).json({ success: false, error: 'Failed to update calibration' });
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
            console.log(`🗑️ Deleted on cleanup: ${filePath}`);
          } catch (e) {
            console.error(`⚠️ Could not delete file: ${filePath} — ${e.message}`);
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

      console.log(`✅ Cleared generated files for record ${recordId}`);
    } catch (e) {
      console.error(`❌ clearGeneratedFiles error: ${e.message}`);
    }
  }
  async generateFAASExcel(req, res) {
    try {
      console.log('=== GENERATE EXCEL REQUEST ===');
      const { recordId } = req.body;

      if (!recordId) {
        return res.status(400).json({
          success: false,
          error: 'Record ID is required'
        });
      }

      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT id, arf_no, owner_name, excel_file_path, unirrig_excel_file_path, pdf_preview_path, unirrig_pdf_preview_path, unirrig_plain_excel_path, unirrig_plain_pdf_path, unirrig_precision_pdf_path FROM faas_records WHERE id = ? AND hidden = 0',
        [recordId]
      );
      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'FAAS record not found'
        });
      }

      const record = records[0];
      console.log(`📊 Generating Excel for: ${record.arf_no}`);

      // Paths
      const pythonDir = path.resolve(__dirname, '../python');
      const pythonScript = path.join(pythonDir, 'excel_generator.py');

      if (!fs.existsSync(pythonScript)) {
        return res.status(500).json({
          success: false,
          error: 'Python script not found'
        });
      }

      // ✅ CHANGED: Use ../python/generated as output path
      const generatedDir = path.join(pythonDir, 'generated');
      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      // Build command
      // Note: we don't pass the outputPath here because the Python script generates its own with timestamp
      const command = `cd "${pythonDir}" && python excel_generator.py --record-id ${recordId} --type both`;
      console.log(`🚀 Command: ${command}`);

      // Execute Python
      exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
        console.log('🐍 Python output:', stdout);

        if (error) {
          console.error('❌ Python error:', stderr || error.message);
          return res.status(500).json({
            success: false,
            error: 'Failed to generate Excel',
            details: stderr || error.message
          });
        }

        try {
          // Parse JSON from Python output
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
            // Delete old files now that we have success (prevents locking issues but keeps old ones if new one fails)
            const oldFiles = [
              record.excel_file_path,
              record.unirrig_excel_file_path,
              record.pdf_preview_path,
              record.unirrig_pdf_preview_path,
              record.unirrig_plain_excel_path,
              record.unirrig_plain_pdf_path,
              record.unirrig_precision_pdf_path
            ];

            oldFiles.forEach(oldPath => {
              if (oldPath && fs.existsSync(oldPath)) {
                try {
                  // Only delete if the path is different from the new one
                  const newPaths = [
                    jsonData.faas ? jsonData.faas.file_path : null,
                    jsonData.unirrig ? jsonData.unirrig.file_path : null
                  ];
                  if (!newPaths.includes(oldPath)) {
                    fs.unlinkSync(oldPath);
                    console.log(`🗑️ Deleted replaced file: ${oldPath}`);
                  }
                } catch (e) {
                  console.error(`⚠️ Cleanup error: ${e.message}`);
                }
              }
            });

            // Save file paths to DB
            const faasPath = jsonData.faas ? jsonData.faas.file_path : null;
            const unirrigPath = jsonData.unirrig ? jsonData.unirrig.file_path : null;

            // ✅ Fix
            const databaseUpdateParams = [faasPath, unirrigPath, recordId];

            await pool.execute(
              'UPDATE faas_records SET excel_file_path = ?, unirrig_excel_file_path = ? WHERE id = ?',
              databaseUpdateParams
            );

            if (faasPath) console.log(`✅ FAAS Excel: ${faasPath}`);
            if (unirrigPath) console.log(`✅ UNIRRIG Excel: ${unirrigPath}`);

            return res.json({
              success: true,
              message: jsonData.success ? 'Both Excel files generated successfully' : 'FAAS Excel generated (UNIRRIG may have failed)',
              data: {
                faas: jsonData.faas ? {
                  filePath: jsonData.faas.file_path,
                  fileName: jsonData.faas.file_name,
                  downloadUrl: `/api/print/download/${jsonData.faas.file_name}`
                } : null,
                unirrig: jsonData.unirrig ? {
                  filePath: jsonData.unirrig.file_path,
                  fileName: jsonData.unirrig.file_name,
                  downloadUrl: `/api/print/download/${jsonData.unirrig.file_name}`
                } : null,
                recordId: recordId,
                arfNo: record.arf_no
              }
            });
          } else if (jsonData && jsonData.success && jsonData.file_path) {
            // Fallback: Only one file generated (legacy)
            const filePath = jsonData.file_path;
            const fileName = jsonData.file_name || path.basename(filePath);
            await pool.execute(
              'UPDATE faas_records SET excel_file_path = ? WHERE id = ?',
              [filePath, recordId]
            );
            console.log(`✅ Excel generated by Python: ${filePath}`);
            return res.json({
              success: true,
              message: 'Excel generated successfully',
              data: {
                filePath: filePath,
                fileName: fileName,
                downloadUrl: `/api/print/download/${fileName}`,
                recordId: recordId,
                arfNo: record.arf_no
              }
            });
          } else {
            // Python didn't return JSON, check if it created a file in subfolders
            const faasDir = path.join(generatedDir, 'FAAS');
            const unirrigDir = path.join(generatedDir, 'UNIRRIG');

            let foundFiles = [];
            if (fs.existsSync(faasDir)) {
              const files = fs.readdirSync(faasDir);
              foundFiles = foundFiles.concat(files.filter(f => f.endsWith('.xlsx') && f.includes(record.arf_no)).map(f => path.join(faasDir, f)));
            }

            if (foundFiles.length > 0) {
              const latestFile = foundFiles[foundFiles.length - 1];
              const filePath = latestFile;
              const fileName = path.basename(filePath);
              await pool.execute(
                'UPDATE faas_records SET excel_file_path = ? WHERE id = ?',
                [filePath, recordId]
              );
              console.log(`✅ Found generated Excel: ${filePath}`);
              return res.json({
                success: true,
                message: 'Excel generated successfully (found in subfolder)',
                data: {
                  filePath: filePath,
                  fileName: fileName,
                  downloadUrl: `/api/print/download/${fileName}`,
                  recordId: recordId,
                  arfNo: record.arf_no
                }
              });
            } else {
              throw new Error('Python script did not generate an Excel file in subfolders');
            }
          }
        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          return res.status(500).json({
            success: false,
            error: 'Failed to process Python output',
            output: stdout.substring(0, 200)
          });
        }
      });

    } catch (error) {
      console.error('❌ Generate Excel error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async executePythonScript(pythonCommand, pythonDir, recordId, record, res) {
    console.log(`🚀 Using Python command: ${pythonCommand}`);

    // Build command - change to python directory first
    const command = `cd "${pythonDir}" && ${pythonCommand} excel_generator.py --record-id ${recordId}`;
    console.log(`🔧 Command: ${command}`);

    exec(command, { cwd: pythonDir }, async (error, stdout, stderr) => {
      console.log('=== PYTHON EXECUTION OUTPUT ===');
      console.log('stdout:', stdout);
      console.log('stderr:', stderr);
      console.log('error:', error);
      console.log('===============================');

      if (error) {
        console.error('❌ Python execution failed:', error);
        return res.status(500).json({
          success: false,
          error: 'Python script execution failed',
          details: stderr || error.message
        });
      }

      // Check if Python printed success
      if (stdout.includes('"success": true') || stdout.includes('✅ Success!')) {
        try {
          // Parse JSON output
          const lines = stdout.split('\n');
          let jsonData = null;

          for (const line of lines) {
            if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
              try {
                jsonData = JSON.parse(line.trim());
                console.log('✅ Parsed JSON output:', jsonData);
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
            console.error('❌ Generated file not found at:', jsonData.file_path);
            throw new Error('Generated file does not exist');
          }

          console.log('✅ File verified at:', jsonData.file_path);

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
              downloadUrl: `/api/print/download/${path.basename(jsonData.file_path)}`,
              recordId: recordId,
              arfNo: record.arf_no
            }
          });

        } catch (parseError) {
          console.error('❌ Parse error:', parseError);
          console.error('Raw stdout:', stdout);
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
      let filePath;

      if (folder && paramFilename) {
        filePath = path.resolve(generatedDir, folder, paramFilename);
      } else {
        filePath = path.resolve(generatedDir, filename);
      }

      console.log('📥 DOWNLOAD DEBUG:');
      console.log(`- Folder: ${folder}, ParamFilename: ${paramFilename}`);
      console.log(`- Raw param: ${rawParam}`);
      console.log(`- Final FilePath: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);
        // List directory to help debug
        const subDir = filename.includes('/') ? path.dirname(filename) : '';
        const searchDir = path.join(generatedDir, subDir);
        if (fs.existsSync(searchDir)) {
          console.log(`- Directory ${searchDir} exists. Contents:`, fs.readdirSync(searchDir));
        } else {
          console.log(`- Directory ${searchDir} does NOT exist.`);
        }

        return res.status(404).json({ success: false, error: 'File not found' });
      }

      // Security: ensure filePath is within generatedDir
      if (!filePath.startsWith(generatedDir)) {
        return res.status(403).json({ success: false, error: 'Invalid file path' });
      }

      console.log('✅ File found, sending download...');

      // Pass only the basename as the second argument (the name the user sees)
      const downloadName = path.basename(filename);
      res.download(filePath, downloadName, (err) => {
        if (err) {
          console.error('❌ Download error:', err);
          if (!res.headersSent) {
            res.status(500).json({
              success: false,
              error: 'Failed to download file'
            });
          }
        } else {
          console.log('✅ Download sent successfully');
        }
      });

    } catch (error) {
      console.error('❌ Download error:', error);
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
          downloadUrl: `/api/print/download/${path.basename(record.excel_file_path)}`
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
      console.error('Get files error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async getApprovedRecords(req, res) {
    try {
      console.log('📋 Getting approved records...');

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

      console.log(`✅ Found ${records.length} approved records`);

      res.json(records);

    } catch (error) {
      console.error('❌ Get approved records error:', error);
      console.error('❌ SQL Error details:', {
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

      console.log(`📦 Releasing record ${id} by user ${userId}`);

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
      console.error('❌ Release record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to release record'
      });
    }
  }

  async getReleasedRecords(req, res) {
    try {
      console.log('📜 Getting released records history...');

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
      console.error('❌ Get released records error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch released records history'
      });
    }
  }
}

module.exports = new PrintController();