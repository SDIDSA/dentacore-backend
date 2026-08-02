const db = require('./database');

async function ensureMigrationsTable() {
  await db.schema
    .createTable('schema_migrations')
    .ifNotExists()
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('filename', 'varchar(255)', (col) => col.notNull().unique())
    .addColumn('applied_at', 'timestamptz', (col) => col.notNull().defaultTo(db.fn('now')))
    .addColumn('checksum', 'varchar(64)')
    .execute();
}

async function getAppliedMigrations() {
  const rows = await db
    .selectFrom('schema_migrations')
    .select('filename')
    .orderBy('filename', 'asc')
    .execute();
  return new Set(rows.map(r => r.filename));
}

async function recordMigration(filename, checksum) {
  await db
    .insertInto('schema_migrations')
    .values({ filename, checksum })
    .execute();
}

async function removeMigration(filename) {
  await db
    .deleteFrom('schema_migrations')
    .where('filename', '=', filename)
    .execute();
}

async function getLastMigration() {
  const row = await db
    .selectFrom('schema_migrations')
    .select(['filename', 'checksum'])
    .orderBy('filename', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row || null;
}

module.exports = { ensureMigrationsTable, getAppliedMigrations, recordMigration, removeMigration, getLastMigration };
