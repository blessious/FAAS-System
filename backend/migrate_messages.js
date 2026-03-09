const mysql = require('mysql2/promise');
require('dotenv').config();

const migrate = async () => {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'realproperty_db'
    });

    try {
        console.log('🚀 Starting migration for messages table...');

        await connection.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id int NOT NULL AUTO_INCREMENT,
                user_id int NOT NULL,
                message text NOT NULL,
                created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                KEY user_id (user_id),
                CONSTRAINT messages_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
        `);

        console.log('✅ Messages table created successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await connection.end();
    }
};

migrate();
