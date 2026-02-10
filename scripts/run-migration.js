require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        const migrationPath = path.join(__dirname, '../MIGRATION_AUTH_HELPER.sql');
        let sql = fs.readFileSync(migrationPath, 'utf8');

        // Remove psql meta-commands
        sql = sql.replace(/^\\.*$/gm, '-- $&'); // Comment out lines starting with \

        console.log('🚀 Executing migration...');

        // Execute the whole script
        await client.query(sql);

        console.log('✅ Migration applied successfully.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await client.end();
    }
}

runMigration();
