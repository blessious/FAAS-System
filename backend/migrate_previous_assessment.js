
require('dotenv').config();
const { connectDB, getConnection } = require('./utils/database');


async function migrate() {
    try {
        await connectDB();
        const pool = getConnection();

        console.log('Checking for new previous assessment columns in faas_records...');
        const [columns] = await pool.execute('DESCRIBE faas_records');
        const columnNames = columns.map(col => col.Field);

        const newColumns = [
            { name: 'previous_td_no2', type: 'VARCHAR(100) DEFAULT NULL' },
            { name: 'previous_owner2', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'previous_av_land2', type: 'DECIMAL(15,2) DEFAULT NULL' },
            { name: 'previous_av_improvements2', type: 'DECIMAL(15,2) DEFAULT NULL' }
        ];

        for (const col of newColumns) {
            if (!columnNames.includes(col.name)) {
                console.log(`Adding ${col.name} column...`);
                await pool.execute(`ALTER TABLE faas_records ADD COLUMN ${col.name} ${col.type}`);
                console.log(`${col.name} added successfully`);
            } else {
                console.log(`${col.name} already exists`);
            }
        }

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
