
const { connectDB, getConnection } = require('./utils/database');

async function migrate() {
    try {
        await connectDB();
        const pool = getConnection();

        console.log('Checking for profile_picture column...');
        const [columns] = await pool.execute('DESCRIBE users');
        const hasColumn = columns.some(col => col.Field === 'profile_picture');

        if (!hasColumn) {
            console.log('Adding profile_picture column...');
            await pool.execute('ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL');
            console.log('Column added successfully');
        } else {
            console.log('Column already exists');
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
