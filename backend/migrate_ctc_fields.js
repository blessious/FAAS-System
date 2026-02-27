
const { connectDB, getConnection } = require('./utils/database');
require('dotenv').config();

async function migrate() {
    try {
        const pool = await connectDB();
        console.log('Migrating database...');

        // Check if columns exist
        const [columns] = await pool.query(`SHOW COLUMNS FROM faas_records`);
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('ctc_no')) {
            await pool.query(`ALTER TABLE faas_records ADD COLUMN ctc_no VARCHAR(100) AFTER rw_row`);
            console.log('Added column ctc_no');
        }

        if (!columnNames.includes('ctc_issued_on')) {
            await pool.query(`ALTER TABLE faas_records ADD COLUMN ctc_issued_on DATE AFTER ctc_no`);
            console.log('Added column ctc_issued_on');
        }

        if (!columnNames.includes('ctc_issued_at')) {
            await pool.query(`ALTER TABLE faas_records ADD COLUMN ctc_issued_at VARCHAR(255) AFTER ctc_issued_on`);
            console.log('Added column ctc_issued_at');
        }

        console.log('✅ Migration successful.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
