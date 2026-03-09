const { getConnection } = require('./database');

/**
 * Creates a notification in the database and broadcasts it via SSE.
 */
const createNotification = async (userId, senderId, type, message, recordId = null) => {
    try {
        const pool = getConnection();
        const [result] = await pool.execute(
            'INSERT INTO notifications (user_id, sender_id, type, message, record_id) VALUES (?, ?, ?, ?, ?)',
            [userId, senderId, type, message, recordId]
        );

        const notificationId = result.insertId;

        // Broadcast to the specifically targeted user if they're connected
        if (global.sendToUserSSE) {
            global.sendToUserSSE(userId, 'notification', {
                id: notificationId,
                user_id: userId,
                sender_id: senderId,
                type,
                message,
                record_id: recordId,
                is_read: 0,
                created_at: new Date().toISOString()
            });
        }

        return notificationId;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

/**
 * Notifies all users with specific roles.
 */
const notifyRoles = async (roles, senderId, type, message, recordId = null) => {
    try {
        const pool = getConnection();
        // roles should be an array, e.g., ['approver', 'administrator']
        const [users] = await pool.query(
            'SELECT id FROM users WHERE role IN (?)',
            [roles]
        );

        const notificationPromises = users.map(user =>
            createNotification(user.id, senderId, type, message, recordId)
        );

        await Promise.all(notificationPromises);
    } catch (error) {
        console.error('Error notifying roles:', error);
    }
};

/**
 * Notifies all users in the system.
 */
const notifyAll = async (senderId, type, message, recordId = null) => {
    try {
        const pool = getConnection();
        const [users] = await pool.execute('SELECT id FROM users');

        const notificationPromises = users.map(user =>
            createNotification(user.id, senderId, type, message, recordId)
        );

        await Promise.all(notificationPromises);
    } catch (error) {
        console.error('Error notifying all users:', error);
    }
};

module.exports = {
    createNotification,
    notifyRoles,
    notifyAll
};
