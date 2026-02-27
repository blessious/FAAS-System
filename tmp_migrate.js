
const { connectDB, getConnection } = require('./backend/utils/database');
require('dotenv').config();

async function migrate() {
    try {
        const pool = await connectDB();
        console.log('Migrating database...');

        await pool.query(`
      ALTER TABLE faas_records 
      ADD COLUMN IF NOT EXISTS ctc_no VARCHAR(100) AFTER rw_row,
      ADD COLUMN IF NOT EXISTS ctc_issued_on DATE AFTER ctc_no,
      ADD COLUMN IF NOT EXISTS ctc_issued_at VARCHAR(255) AFTER ctc_issued_on
    `);

        console.log('✅ Migration successful: Added ctc_no, ctc_issued_on, ctc_issued_at columns.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
