require('dotenv').config();
const { Client } = require('pg');

// DANGER: FORCE ROW LEVEL SECURITY with no CREATE POLICY statements makes
// every table default-DENY — including the table owner. The app has no RLS
// policies yet (tenancy is enforced app-layer via tenant_id filters), so
// running this as-is silently bricks all data access.
//
// This script therefore refuses to run unless you explicitly acknowledge
// that by setting ENABLE_FORCE_RLS=true in the environment AND creating
// per-tenant policies first.

async function applyForceRLS() {
    if (process.env.ENABLE_FORCE_RLS !== 'true') {
        console.error('❌ Refusing to run: FORCE RLS with no policies default-denies ALL access.');
        console.error('   1) Create per-tenant policies first (USING (tenant_id = current_setting(\'app.current_tenant\')::uuid))');
        console.error('   2) Then re-run with ENABLE_FORCE_RLS=true to acknowledge the risk.');
        console.error('   To undo a previous run: ALTER TABLE <table> NO FORCE ROW LEVEL SECURITY;');
        process.exit(1);
    }

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
        process.exitCode = 1;
    } finally {
        await client.end();
    }
}

applyForceRLS();
