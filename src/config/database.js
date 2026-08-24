const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');
const log = require('../utils/logger');

const pg = require('pg');
//pg.types.setTypeParser(1114, (str) => { const d = new Date(str); return isNaN(d.getTime()) ? str : d; })

const requiredEnv = ['DB_USER', 'DB_NAME', 'DB_PASSWORD'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingEnv.join(', ')}. ` +
      'Set them in .env or the environment before starting the application.'
  );
}

const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5434,
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
      log.info('Database connected');
    } catch (error) {
      log.error('Database connection failed', { message: error.message });
    }
  })();
}

module.exports = db;
