const { getConnection } = require('../utils/database');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const printController = require('./printController');
const { createNotification } = require('../utils/notifications');

// Helper function for PDF generation
async function generatePDF(recordId, excelFilePath) {
  try {
    const pythonDir = path.resolve(__dirname, '../python');
    const pythonScript = path.join(pythonDir, 'pdf_converter.py');

    if (!fs.existsSync(pythonScript)) {
      return { success: false, error: 'PDF converter script not found' };
    }

    const pdfDir = path.join(path.dirname(excelFilePath), 'generated-pdf');
    const pdfFilename = path.basename(excelFilePath).replace('.xlsx', '.pdf');
    const pdfPath = path.join(pdfDir, pdfFilename);

    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    const absoluteExcelPath = path.resolve(excelFilePath);
    const absolutePdfPath = path.resolve(pdfPath);

    const command = `cd "${pythonDir}" && python pdf_converter.py --excel-path "${absoluteExcelPath}" --pdf-path "${absolutePdfPath}"`;

    logger.debug(`ðŸ“„ PDF Conversion Command: ${command}`);

    return new Promise((resolve) => {
      exec(command, { cwd: pythonDir }, (error, stdout, stderr) => {
        if (stdout) logger.debug('ðŸ“„ PDF Conversion STDOUT:', stdout);
        if (stderr) logger.error('ðŸ“„ PDF Conversion STDERR:', stderr);

        if (error) {
          logger.error('âŒ PDF process error:', error.message);
          resolve({
            success: false,
            error: stderr || error.message,
            message: 'PDF conversion process failed'
          });
          return;
        }

        try {
          // Look for any line that starts with { and ends with }
          const lines = stdout.split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.startsWith('{') && line.endsWith('}')) {
              try {
                const jsonData = JSON.parse(line);
                if (jsonData.success) {
                  resolve({
                    success: true,
                    message: 'PDF generated successfully',
                    data: { pdfPath: jsonData.pdf_path || pdfPath }
                  });
                  return;
                }
              } catch (e) { }
            }
          }
        } catch (parseError) { }

        if (fs.existsSync(pdfPath)) {
          resolve({ success: true, message: 'PDF generated successfully', data: { pdfPath } });
        } else {
          resolve({ success: false, error: 'PDF file not created', message: 'PDF generation failed' });
        }
      });
    });
  } catch (error) {
    logger.error('PDF generation error:', error);
    return { success: false, error: error.message };
  }
}

class ApprovalController {
  async getPendingApprovals(req, res) {
    try {
      const pool = getConnection();
      const [records] = await pool.execute(`
        SELECT 
          f.*,
          f.updated_at,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name,
          uu.full_name as updater_name,
          uu.profile_picture as updater_profile_picture,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0) as linked_entries_count,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0 AND status = 'for_approval') as pending_linked_count,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0 AND status = 'rejected') as rejected_linked_count
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        LEFT JOIN users uu ON f.updated_by = uu.id
        WHERE f.parent_id IS NULL 
          AND f.hidden = 0
          AND (
            f.status = 'for_approval'
            OR EXISTS (SELECT 1 FROM faas_records WHERE parent_id = f.id AND status = 'for_approval' AND hidden = 0)
          )
        ORDER BY COALESCE(f.updated_at, f.created_at) DESC
      `); // âœ… No parameters needed

      res.json(records);

    } catch (error) {
      logger.error('Get pending approvals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending approvals'
      });
    }
  }

  async approveRecord(req, res) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      const pool = getConnection();

      // Get record info before updating
      const [records] = await pool.execute('SELECT * FROM faas_records WHERE id = ? AND hidden = 0', [id]);
      const record = records[0];

      logger.debug(`âœ… Approving record ${id} by user ${userId}`);
      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'approved',
          approver_id = ?,
          approval_date = NOW(),
          rejection_reason = ?,
          updated_by = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [userId, comment || null, userId, id]);

      // âœ… REGENERATE EXCEL & PDF AFTER APPROVAL (to include approval_date)
      logger.debug(`ðŸ“Š Regenerating Excel for approved record: ${id}`);
      try {
        const excelResult = await new Promise((resolve) => {
          const mockReq = { body: { recordId: id }, user: req.user };
          const mockRes = {
            json: (result) => resolve(result),
            status: () => ({ json: (result) => resolve({ success: false, ...result }) })
          };
          printController.generateFAASExcel(mockReq, mockRes);
        });

        if (excelResult.success && excelResult.data) {
          const faasExcelPath = excelResult.data.faas ? excelResult.data.faas.filePath : (excelResult.data.filePath || null);
          const unirrigExcelPath = excelResult.data.unirrig ? excelResult.data.unirrig.filePath : null;

          if (faasExcelPath) {
            logger.debug(`ðŸ“„ Generating FAAS PDF preview for ${id}`);
            const pdfRes = await generatePDF(id, faasExcelPath);
            if (pdfRes.success) {
              await pool.execute('UPDATE faas_records SET pdf_preview_path = ? WHERE id = ?', [pdfRes.data.pdfPath, id]);
            }
          }

          if (unirrigExcelPath) {
            logger.debug(`ðŸ“„ Generating UNIRRIG PDF preview for ${id}`);
            const pdfRes = await generatePDF(id, unirrigExcelPath);
            if (pdfRes.success) {
              await pool.execute('UPDATE faas_records SET unirrig_pdf_preview_path = ? WHERE id = ?', [pdfRes.data.pdfPath, id]);
            }
          }
        }
      } catch (genError) {
        logger.error('âš ï¸ Post-approval regeneration error (non-critical):', genError.message);
      }

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'APPROVE', 'faas_records', id, `Approved FAAS record ${id}`]);

      // Broadcast real-time event
      if (global.broadcastSSE && record) {
        global.broadcastSSE('recordChange', {
          action: 'approved',
          record: {
            id: record.id,
            arf_no: record.arf_no,
            pin: record.pin,
            owner_name: record.owner_name,
            status: 'approved',
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      // Add notification for the encoder
      if (record && record.encoder_id) {
        await createNotification(
          record.encoder_id,
          userId,
          'RECORD_APPROVED',
          `Your FAAS record ${record.arf_no || id} has been approved by ${req.user.fullName || req.user.username}`,
          id
        );
      }

      res.json({
        success: true,
        message: 'Record approved successfully'
      });

    } catch (error) {
      logger.error('Approve record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve record'
      });
    }
  }

  async rejectRecord(req, res) {
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;

      if (!comment || comment.trim() === '') {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }

      const pool = getConnection();

      // Get record info before updating
      const [records] = await pool.execute('SELECT * FROM faas_records WHERE id = ? AND hidden = 0', [id]);
      const record = records[0];

      if (!record) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      logger.debug(`âŒ Rejecting record ${id} by user ${userId}`);
      // Reject only the actual record
      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'rejected',
          approver_id = ?,
          approval_date = NOW(),
          rejection_reason = ?,
          updated_by = ?,
          updated_at = NOW()
        WHERE id = ? AND hidden = 0
      `, [userId, comment, userId, id]);

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'REJECT', 'faas_records', id, `Rejected record ID ${id}. Reason: ${comment}`]);

      // Broadcast real-time event
      if (global.broadcastSSE && record) {
        global.broadcastSSE('recordChange', {
          action: 'rejected',
          record: {
            id: id,
            arf_no: record.arf_no,
            pin: record.pin,
            owner_name: record.owner_name,
            status: 'rejected',
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      // Add notification for the encoder
      if (record && record.encoder_id) {
        await createNotification(
          record.encoder_id,
          userId,
          'RECORD_REJECTED',
          `Your FAAS record ${record.arf_no || id} has been rejected by ${req.user.fullName || req.user.username}. Reason: ${comment}`,
          id
        );
      }

      res.json({
        success: true,
        message: 'Record rejected successfully'
      });

    } catch (error) {
      logger.error('Reject record error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject record'
      });
    }
  }

  async getApprovalHistory(req, res) {
    try {
      const pool = getConnection();
      const [records] = await pool.execute(`
        SELECT 
          f.*,
          f.updated_at,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name,
          uu.full_name as updater_name,
          uu.profile_picture as updater_profile_picture
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        LEFT JOIN users uu ON f.updated_by = uu.id
        WHERE f.status IN ('approved', 'rejected')
          AND f.hidden = 0
        ORDER BY f.approval_date DESC
      `); // âœ… Removed params array

      res.json(records);

    } catch (error) {
      logger.error('Get approval history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approval history'
      });
    }
  }

  async getRejectedRecords(req, res) {
    try {
      const pool = getConnection();

      const [records] = await pool.execute(`
        SELECT 
          f.*,
          f.updated_at,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name,
          uu.full_name as updater_name,
          uu.profile_picture as updater_profile_picture,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0) as linked_entries_count,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0 AND status = 'for_approval') as pending_linked_count,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0 AND status = 'rejected') as rejected_linked_count
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        LEFT JOIN users uu ON f.updated_by = uu.id
        WHERE f.parent_id IS NULL
          AND f.hidden = 0
          AND (
            f.status = 'rejected'
            OR EXISTS (SELECT 1 FROM faas_records WHERE parent_id = f.id AND status = 'rejected' AND hidden = 0)
          )
        ORDER BY f.approval_date DESC
      `);

      res.json(records);

    } catch (error) {
      logger.error('Get rejected records error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rejected records'
      });
    }
  }

  async getApprovalStats(req, res) {
    try {
      const pool = getConnection();
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total,
          SUM(status = 'draft') as drafts,
          SUM(status = 'for_approval') as pending,
          SUM(status = 'approved') as approved,
          SUM(status = 'rejected') as rejected
        FROM faas_records WHERE hidden = 0
      `);

      res.json(stats[0]);

    } catch (error) {
      logger.error('Get approval stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch approval statistics'
      });
    }
  }

  async cancelAction(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const pool = getConnection();

      // Get record info before updating
      const [records] = await pool.execute('SELECT * FROM faas_records WHERE id = ? AND hidden = 0', [id]);
      const record = records[0];

      if (!record) {
        return res.status(404).json({ success: false, error: 'Record not found' });
      }

      logger.debug(`ðŸ”„ Cancelling action for record ${id} by user ${userId}`);

      // Clear all generated files (including precision PDF) so they are regenerated on next approval
      try {
        await printController.clearGeneratedFiles(id);
      } catch (cleanError) {
        logger.error('âš ï¸ Cleanup error during cancelAction:', cleanError.message);
      }

      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'for_approval',
          approver_id = NULL,
          approval_date = NULL,
          rejection_reason = NULL,
          updated_by = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [userId, id]);

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'CANCEL_ACTION', 'faas_records', id, `Cancelled approval/rejection for record ${id}. Status reverted to pending.`]);

      // Broadcast real-time event
      if (global.broadcastSSE) {
        global.broadcastSSE('recordChange', {
          action: 'updated',
          record: {
            ...record,
            pin: record.pin,
            status: 'for_approval'
          },
          timestamp: new Date().toISOString()
        });
      }

      // Add notification for the encoder
      if (record && record.encoder_id) {
        await createNotification(
          record.encoder_id,
          userId,
          'ACTION_CANCELLED',
          `The approval action for your record ${record.arf_no || id} was cancelled by ${req.user.fullName || req.user.username}. It is now back to pending.`,
          id
        );
      }

      res.json({
        success: true,
        message: 'Action cancelled successfully. Record is now pending approval.'
      });

    } catch (error) {
      logger.error('Cancel action error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel action'
      });
    }
  }
}

module.exports = new ApprovalController();

