require('dotenv').config({ path: '../.env' });

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});
console.log("DATABASE_URL:", process.env.DATABASE_URL);
module.exports = pool;
// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to PostgreSQL');
    release();
  }
});

// Helper: run a parameterised query and return rows
const query = (text, params) => pool.query(text, params);

// Helper: grab a client for transactions
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };