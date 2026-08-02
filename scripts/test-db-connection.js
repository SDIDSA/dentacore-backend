require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'dentacore',
    user: process.env.DB_USER || 'dentacore',
    password: process.env.DB_PASSWORD,
});

async function testConnection() {
    console.log('Testing database connection...');
    console.log(`  Host: ${pool.options.host}`);
    console.log(`  Port: ${pool.options.port}`);
    console.log(`  Database: ${pool.options.database}`);
    console.log(`  User: ${pool.options.user}`);
    console.log();

    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() AS current_time, version() AS pg_version');
        const row = result.rows[0];
        console.log('✓ Connection successful!');
        console.log(`  Server time: ${row.current_time}`);
        console.log(`  PostgreSQL: ${row.pg_version}`);
        client.release();
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('✗ Connection failed:', err.message);
        console.error();
        console.error('Troubleshooting:');
        console.error('  1. Is PostgreSQL running?');
        console.error('  2. Is DB_PASSWORD set in .env?');
        console.error('  3. Has recreate-db.cmd been run at least once?');
        await pool.end();
        process.exit(1);
    }
}

testConnection();
