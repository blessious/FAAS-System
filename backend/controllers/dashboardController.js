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
      const search = req.query.search || "";
      const offset = (page - 1) * limit;

      let whereClause = "WHERE f.hidden = 0 AND f.parent_id IS NULL";
      let countWhereClause = "WHERE hidden = 0 AND parent_id IS NULL";
      let queryParams = [];
      let countParams = [];

      if (search) {
        const searchCondition = ` AND (
          f.pin LIKE ? OR 
          f.arf_no LIKE ? OR 
          f.owner_name LIKE ? OR 
          f.property_location LIKE ? OR
          EXISTS (
            SELECT 1
            FROM faas_records s
            WHERE s.parent_id = f.id
              AND s.hidden = 0
              AND (
                s.pin LIKE ? OR
                s.arf_no LIKE ? OR
                s.owner_name LIKE ? OR
                s.property_location LIKE ?
              )
          )
        )`;
        whereClause += searchCondition;

        const countCondition = ` AND (
          pin LIKE ? OR 
          arf_no LIKE ? OR 
          owner_name LIKE ? OR 
          property_location LIKE ? OR
          EXISTS (
            SELECT 1
            FROM faas_records s
            WHERE s.parent_id = faas_records.id
              AND s.hidden = 0
              AND (
                s.pin LIKE ? OR
                s.arf_no LIKE ? OR
                s.owner_name LIKE ? OR
                s.property_location LIKE ?
              )
          )
        )`;
        countWhereClause += countCondition;

        const searchPattern = `%${search}%`;
        queryParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
        countParams.push(
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern,
          searchPattern
        );
      }

      // Get total count for pagination with search filter
      const [countResult] = await pool.query(`
        SELECT COUNT(*) as total
        FROM faas_records
        ${countWhereClause}
      `, countParams);
      const totalRecords = countResult[0].total;

      // Add limit and offset to queryParams
      queryParams.push(limit, offset);

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
          f.updated_at,
          f.parent_id,
          (SELECT COUNT(*) FROM faas_records WHERE parent_id = f.id AND hidden = 0) as linked_entries_count,
          ue.full_name as encoder_name,
          ue.profile_picture as encoder_profile_picture,
          uu.full_name as updater_name,
          uu.profile_picture as updater_profile_picture
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id 
        LEFT JOIN users uu ON f.updated_by = uu.id
        ${whereClause}
        ORDER BY COALESCE(f.updated_at, f.created_at) ASC
        LIMIT ? OFFSET ?`,
        queryParams
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
          ue.profile_picture as encoder_profile_picture,
          uu.full_name as updater_name,
          uu.profile_picture as updater_profile_picture
        FROM faas_records f
        LEFT JOIN users ue ON f.encoder_id = ue.id
        LEFT JOIN users uu ON f.updated_by = uu.id
        WHERE f.parent_id = ? AND f.hidden = 0
        ORDER BY COALESCE(f.updated_at, f.created_at) DESC
      `, [parentId]);

      res.json(entries);
    } catch (error) {
      console.error('Get linked entries error:', error);
      res.status(500).json({ error: 'Failed to fetch linked entries' });
    }
  }
}

module.exports = new DashboardController();