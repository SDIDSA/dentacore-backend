const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');
const { ensureMigrationsTable, getAppliedMigrations, recordMigration } = require('./migrations');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'migrations');

async function autoMigrate(logger) {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.up.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    logger.info(`Applying migration ${file}`);
    try {
      const { sql: kyselySql } = require('kysely');
      await kyselySql.raw(sql).execute(db);
      await recordMigration(file, checksum);
      count++;
    } catch (err) {
      logger.error(`Migration ${file} failed`, { error: err.message });
      throw err;
    }
  }

  logger.info(`Auto-migration complete (${count} applied)`);
}

module.exports = { autoMigrate };
