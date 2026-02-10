require('dotenv').config();
const { Client } = require('pg');

async function applyForceRLS() {
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

        const tables = [
            'users', 'patients', 'appointments', 'treatment_records',
            'invoices', 'invoice_items', 'payments', 'audit_logs'
        ];

        for (const table of tables) {
            console.log(`Applying FORCE RLS to ${table}...`);
            await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`);
        }

        console.log('✅ FORCE RLS applied successfully.');

    } catch (error) {
        console.error('❌ Failed to apply FORCE RLS:', error);
    } finally {
        await client.end();
    }
}

applyForceRLS();
