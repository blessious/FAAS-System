const { getConnection } = require('../utils/database');

const getMyNotifications = async (req, res) => {
    try {
        const userId = req.user.id; // From authMiddleware
        const pool = getConnection();

        // Get latest 50 notifications for this user
        const [notifications] = await pool.execute(
            `SELECT n.*, u.full_name as sender_name, u.profile_picture as sender_profile_picture 
       FROM notifications n 
       LEFT JOIN users u ON n.sender_id = u.id 
       WHERE n.user_id = ? 
       ORDER BY n.created_at DESC 
       LIMIT 50`,
            [userId]
        );

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const pool = getConnection();

        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
            [id, userId]
        );

        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const pool = getConnection();

        await pool.execute(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ?',
            [userId]
        );

        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
};

const deleteOldNotifications = async (req, res) => {
    // Optional maintenance
    try {
        const pool = getConnection();
        // Keep only last 30 days
        await pool.execute('DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)');
        res.json({ message: 'Old notifications deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete old notifications' });
    }
};

module.exports = {
    getMyNotifications,
    markAsRead,
    markAllAsRead,
    deleteOldNotifications
};
