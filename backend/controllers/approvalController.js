const { getConnection } = require('../utils/database');

class ApprovalController {
  async getPendingApprovals(req, res) {
    try {
      const pool = getConnection();
      const [records] = await pool.execute(`
        SELECT 
          f.*,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.status = 'for_approval'
          AND f.hidden = 0
        ORDER BY f.created_at DESC
      `); // ✅ No parameters needed

      res.json(records);

    } catch (error) {
      console.error('Get pending approvals error:', error);
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

      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'approved',
          approver_id = ?,
          approval_date = NOW(),
          rejection_reason = ?
        WHERE id = ?
      `, [userId, comment || null, id]);

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
            owner_name: record.owner_name,
            status: 'approved',
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Record approved successfully'
      });

    } catch (error) {
      console.error('Approve record error:', error);
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

      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'rejected',
          approver_id = ?,
          approval_date = NOW(),
          rejection_reason = ?
        WHERE id = ?
      `, [userId, comment, id]);

      // Log activity
      await pool.execute(`
        INSERT INTO activity_log (user_id, action, table_name, record_id, description)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'REJECT', 'faas_records', id, `Rejected FAAS record ${id}: ${comment}`]);

      // Broadcast real-time event
      if (global.broadcastSSE && record) {
        global.broadcastSSE('recordChange', {
          action: 'rejected',
          record: {
            id: record.id,
            arf_no: record.arf_no,
            owner_name: record.owner_name,
            status: 'rejected',
            encoder_id: record.encoder_id
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Record rejected successfully'
      });

    } catch (error) {
      console.error('Reject record error:', error);
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
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.status IN ('approved', 'rejected')
          AND f.hidden = 0
        ORDER BY f.approval_date DESC
      `); // ✅ Removed params array

      res.json(records);

    } catch (error) {
      console.error('Get approval history error:', error);
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
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          ua.full_name as approver_name
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users ua ON f.approver_id = ua.id
        WHERE f.status = 'rejected'
          AND f.hidden = 0
        ORDER BY f.approval_date DESC
      `);

      res.json(records);

    } catch (error) {
      console.error('Get rejected records error:', error);
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
      console.error('Get approval stats error:', error);
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

      await pool.execute(`
        UPDATE faas_records 
        SET 
          status = 'for_approval',
          approver_id = NULL,
          approval_date = NULL,
          rejection_reason = NULL
        WHERE id = ?
      `, [id]);

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
            status: 'for_approval'
          },
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        message: 'Action cancelled successfully. Record is now pending approval.'
      });

    } catch (error) {
      console.error('Cancel action error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel action'
      });
    }
  }
}

module.exports = new ApprovalController();