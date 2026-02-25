const { getConnection } = require('../utils/database');

class DashboardController {
  async getStats(req, res) {
    try {
      const pool = getConnection();
      const [stats] = await pool.query(`
        SELECT 
          COUNT(*) as totalRecords,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
          SUM(CASE WHEN status = 'for_approval' THEN 1 ELSE 0 END) as pendingApproval,
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM faas_records WHERE hidden = 0
      `);

      res.json(stats[0]);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }

  async getRecentRecords(req, res) {
    try {
      const pool = getConnection();

      // Get pagination parameters from query string
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const [countResult] = await pool.query(`
        SELECT COUNT(*) as total
        FROM faas_records
        WHERE hidden = 0 AND parent_id IS NULL
      `);
      const totalRecords = countResult[0].total;

      // Get paginated records
      const [records] = await pool.query(
        `SELECT 
          f.id,
          f.arf_no,
          f.pin,
          f.owner_name,
          f.property_location,
          f.status,
          f.rejection_reason,
          f.created_at,
          f.parent_id,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0) as linked_entries_count,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id 
        WHERE f.hidden = 0 AND f.parent_id IS NULL
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      // Return paginated response
      res.json({
        data: records,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages: Math.ceil(totalRecords / limit),
          hasNextPage: page < Math.ceil(totalRecords / limit),
          hasPreviousPage: page > 1
        }
      });
    } catch (error) {
      console.error('Get recent records error:', error);
      res.status(500).json({
        error: 'Failed to fetch recent records',
        message: error.message
      });
    }
  }

  async getActivityLog(req, res) {
    try {
      const pool = getConnection();
      const [activities] = await pool.query(`
        SELECT 
          al.*,
          u.username,
          u.full_name,
          u.profile_picture
        FROM activity_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 20
      `);

      res.json(activities);
    } catch (error) {
      console.error('Get activity log error:', error);
      res.status(500).json({ error: 'Failed to fetch activity log' });
    }
  }

  async getLinkedEntries(req, res) {
    try {
      const { id: parentId } = req.params;
      const pool = getConnection();

      const [entries] = await pool.query(`
        SELECT 
          f.id,
          f.arf_no,
          f.pin,
          f.owner_name,
          f.property_location,
          f.status,
          f.rejection_reason,
          f.created_at,
          f.parent_id,
          f.pdf_preview_path,
          f.unirrig_pdf_preview_path,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        WHERE f.parent_id = ? AND f.hidden = 0
        ORDER BY f.created_at DESC
      `, [parentId]);

      res.json(entries);
    } catch (error) {
      console.error('Get linked entries error:', error);
      res.status(500).json({ error: 'Failed to fetch linked entries' });
    }
  }
}

module.exports = new DashboardController();