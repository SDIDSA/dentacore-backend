require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');
const { ensureMigrationsTable, getAppliedMigrations, recordMigration } = require('../src/config/migrations');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function runMigrations() {
  console.log('Running migrations...');

  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  SKIP ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    console.log(`  APPLY ${file}...`);

    try {
      const { sql: kyselySql } = require('kysely');
      await kyselySql.raw(sql).execute(db);

      await recordMigration(file, checksum);
      count++;
      console.log(`  DONE  ${file}`);
    } catch (err) {
      console.error(`  FAIL  ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('No pending migrations.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }

  await db.destroy();
}

runMigrations().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
