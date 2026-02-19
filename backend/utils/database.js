 
const mysql = require('mysql2/promise');
require('dotenv').config();

let pool;

const connectDB = async () => {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  // Test connection
  const connection = await pool.getConnection();
  console.log(`✅ Connected to MySQL database: ${process.env.DB_NAME}`);
  connection.release();
  
  return pool;
};

const getConnection = () => {
  if (!pool) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return pool;
};

module.exports = { connectDB, getConnection };