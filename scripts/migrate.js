require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('../src/config/database');
const { ensureMigrationsTable, getAppliedMigrations, recordMigration, removeMigration, getLastMigration } = require('../src/config/migrations');

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

const command = process.argv[2] || 'up';

async function runMigrations() {
  console.log('Running migrations up...');

  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    const isDown = file.includes('.down.');
    if (isDown) continue;

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

async function rollbackMigration() {
  console.log('Running migrations down...');

  await ensureMigrationsTable();

  const last = await getLastMigration();
  if (!last) {
    console.log('No migrations to roll back.');
    await db.destroy();
    return;
  }

  const downFile = last.filename.endsWith('.up.sql')
    ? last.filename.replace(/\.up\.sql$/, '.down.sql')
    : last.filename.replace(/\.sql$/, '.down.sql');
  const downPath = path.join(MIGRATIONS_DIR, downFile);

  if (!fs.existsSync(downPath)) {
    console.error(`  FAIL  No down migration found for ${last.filename}`);
    console.error(`  Expected: ${downPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(downPath, 'utf8');

  console.log(`  ROLLBACK ${last.filename}...`);

  try {
    const { sql: kyselySql } = require('kysely');
    await kyselySql.raw(sql).execute(db);

    await removeMigration(last.filename);
    console.log(`  DONE  Rolled back ${last.filename}`);
  } catch (err) {
    console.error(`  FAIL  ${downFile}: ${err.message}`);
    process.exit(1);
  }

  await db.destroy();
}

async function main() {
  if (command === 'down' || command === 'rollback') {
    await rollbackMigration();
  } else {
    await runMigrations();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
