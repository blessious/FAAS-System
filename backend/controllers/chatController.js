const { getConnection } = require('../utils/database');

class ChatController {
    async sendMessage(req, res) {
        try {
            const { message } = req.body;
            const userId = req.user.id;

            if (!message || message.trim() === '') {
                return res.status(400).json({ success: false, error: 'Message content is required' });
            }

            const pool = getConnection();
            const [result] = await pool.execute(
                'INSERT INTO messages (user_id, message) VALUES (?, ?)',
                [userId, message]
            );

            const messageId = result.insertId;

            // Fetch full message data with user info for broadcast
            const [newMessages] = await pool.execute(`
                SELECT 
                    m.*,
                    u.full_name,
                    u.username,
                    u.role,
                    u.profile_picture
                FROM messages m
                JOIN users u ON m.user_id = u.id
                WHERE m.id = ?
            `, [messageId]);

            const fullMessage = newMessages[0];

            // Broadcast via SSE
            if (global.broadcastSSE) {
                global.broadcastSSE('chatMessage', fullMessage);
            }

            res.json({
                success: true,
                data: fullMessage
            });
        } catch (error) {
            console.error('Send message error:', error);
            res.status(500).json({ success: false, error: 'Failed to send message' });
        }
    }

    async getMessages(req, res) {
        try {
            const pool = getConnection();
            // Fetch last 100 messages
            const [messages] = await pool.execute(`
                SELECT 
                    m.*,
                    u.full_name,
                    u.username,
                    u.role,
                    u.profile_picture
                FROM messages m
                JOIN users u ON m.user_id = u.id
                ORDER BY m.created_at ASC
                LIMIT 100
            `);

            res.json(messages);
        } catch (error) {
            console.error('Get messages error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch messages' });
        }
    }
}

module.exports = new ChatController();
