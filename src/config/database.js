const { Kysely, PostgresDialect } = require('kysely');
const { Pool } = require('pg');

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
  })
});

const db = new Kysely({
  dialect,
});

// Test connection
(async () => {
  try {
    await db.selectFrom('roles').select('id').limit(1).execute();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
})();

module.exports = db;
