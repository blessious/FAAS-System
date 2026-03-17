const { connectDB, getConnection } = require('./utils/database');

async function migrate() {
    try {
        await connectDB();
        const pool = getConnection();

        console.log('Checking for notifications table...');
        const [tables] = await pool.execute("SHOW TABLES LIKE 'notifications'");

        if (tables.length === 0) {
            console.log('Creating notifications table...');
            await pool.execute(`
                CREATE TABLE IF NOT EXISTS \`notifications\` (
                  \`id\` int NOT NULL AUTO_INCREMENT,
                  \`user_id\` int NOT NULL,
                  \`sender_id\` int DEFAULT NULL,
                  \`type\` varchar(50) DEFAULT NULL,
                  \`message\` text,
                  \`record_id\` int DEFAULT NULL,
                  \`is_read\` tinyint(1) DEFAULT '0',
                  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (\`id\`),
                  KEY \`user_id\` (\`user_id\`),
                  KEY \`sender_id\` (\`sender_id\`),
                  KEY \`idx_notification_created_at\` (\`created_at\`),
                  CONSTRAINT \`notifications_ibfk_1\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
                  CONSTRAINT \`notifications_ibfk_2\` FOREIGN KEY (\`sender_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);
            console.log('Notifications table created successfully');
        } else {
            console.log('Notifications table already exists');
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
