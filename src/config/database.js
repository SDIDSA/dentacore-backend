const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');

const pg = require('pg');
pg.types.setTypeParser(1114, (str) => { const d = new Date(str.replace(' ', 'T') + 'Z'); return isNaN(d.getTime()) ? str : d; })

const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  })
});

const db = new Kysely({
  dialect,
});

// Test connection (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      const { sql } = require('kysely');
      await sql`SELECT 1`.execute(db);
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
    }
  })();
}

module.exports = db;
