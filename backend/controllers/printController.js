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

  async clearGeneratedFiles(recordId) {
    try {
      const pool = getConnection();
      const [records] = await pool.execute(
        'SELECT excel_file_path, unirrig_excel_file_path, pdf_preview_path, unirrig_pdf_preview_path FROM faas_records WHERE id = ?',
        [recordId]
      );

      if (records.length === 0) return;

      const record = records[0];

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
            console.log(`🗑️ Deleted on edit: ${filePath}`);
          } catch (e) {
            console.error(`⚠️ Could not delete file: ${filePath} — ${e.message}`);
          }
        }
      });

      // Clear paths in DB
      await pool.execute(
        `UPDATE faas_records 
        SET excel_file_path = NULL, unirrig_excel_file_path = NULL, 
            pdf_preview_path = NULL, unirrig_pdf_preview_path = NULL 
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
              record.unirrig_pdf_preview_path
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
      const { filename } = req.params;
      const generatedDir = path.join(__dirname, '../python/generated');
      const filePath = path.join(generatedDir, filename);

      console.log(`📥 Download request for: ${filename}`);
      console.log(`📁 Looking for file at: ${filePath}`);
      console.log(`📁 Directory exists: ${fs.existsSync(generatedDir)}`);

      if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath);

        // Try to find file anywhere in generated folder
        if (fs.existsSync(generatedDir)) {
          const files = fs.readdirSync(generatedDir);
          console.log('Available files in generated folder:', files);
        }

        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }

      console.log('✅ File found, sending download...');

      res.download(filePath, filename, (err) => {
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
        f.excel_file_path,
        f.pdf_preview_path,
        f.unirrig_pdf_preview_path,
        ue.full_name as encoder_name,
        ue.profile_picture as encoder_profile_picture,
        ua.full_name as approver_name,
        f.status
      FROM faas_records f
      LEFT JOIN users ue ON f.encoder_id = ue.id
      LEFT JOIN users ua ON f.approver_id = ua.id
      WHERE f.status = 'approved'
        AND f.hidden = 0
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
}

module.exports = new PrintController();