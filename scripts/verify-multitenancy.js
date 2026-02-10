require('dotenv').config();
const db = require('../src/config/database');
const { sql } = require('kysely');
const crypto = require('crypto');

async function testMultitenancy() {
    console.log('🧪 Starting Multi-tenancy Verification...');

    const tenantA_name = 'TestTenant A';
    const tenantA_code = 'testa' + crypto.randomBytes(2).toString('hex');
    const tenantB_name = 'TestTenant B';
    const tenantB_code = 'testb' + crypto.randomBytes(2).toString('hex');

    let tenantA_id, tenantB_id;

    try {
        // 1. Create two tenants
        console.log(`\nCreating tenants: ${tenantA_code}, ${tenantB_code}`);

        tenantA_id = (await db.insertInto('tenants').values({
            name: tenantA_name,
            subdomain: tenantA_code,
            subscription_status: 'tenant.status.active',
            is_active: true
        }).returning('id').executeTakeFirst()).id;

        tenantB_id = (await db.insertInto('tenants').values({
            name: tenantB_name,
            subdomain: tenantB_code,
            subscription_status: 'tenant.status.active',
            is_active: true
        }).returning('id').executeTakeFirst()).id;

        console.log(`✅ Tenants created. IDs: ${tenantA_id}, ${tenantB_id}`);

        // 2. Create data in Tenant A
        console.log('\nCreating patient in Tenant A...');
        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenantA_id}::text, true)`.execute(trx);

            await trx.insertInto('patients').values({
                tenant_id: tenantA_id,
                full_name: 'Patient A',
                patient_code: 'PAT-A-001',
                date_of_birth: '1990-01-01',
                gender: 'patient.gender.male',
                phone: '+213555000001',
                status_key: 'user.status.active'
            }).execute();
        });
        console.log('✅ Patient A created.');

        // 3. Create data in Tenant B
        console.log('\nCreating patient in Tenant B...');
        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenantB_id}::text, true)`.execute(trx);

            await trx.insertInto('patients').values({
                tenant_id: tenantB_id,
                full_name: 'Patient B',
                patient_code: 'PAT-B-001',
                date_of_birth: '1990-01-01',
                gender: 'patient.gender.female',
                phone: '+213555000002',
                status_key: 'user.status.active'
            }).execute();
        });
        console.log('✅ Patient B created.');


        // 4. Verify Isolation: Tenant A context should only see Patient A
        console.log('\nVerifying isolation for Tenant A...');
        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenantA_id}::text, true)`.execute(trx);

            const patients = await trx.selectFrom('patients').selectAll().execute();
            console.log(`Found ${patients.length} patients.`);

            if (patients.length === 1 && patients[0].full_name === 'Patient A') {
                console.log('✅ PASS: Tenant A sees only Patient A.');
            } else {
                console.error('❌ FAIL: Tenant A saw unexpected data:', patients);
            }
        });

        // 5. Verify Isolation: Tenant B context should only see Patient B
        console.log('\nVerifying isolation for Tenant B...');
        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenantB_id}::text, true)`.execute(trx);

            const patients = await trx.selectFrom('patients').selectAll().execute();
            console.log(`Found ${patients.length} patients.`);

            if (patients.length === 1 && patients[0].full_name === 'Patient B') {
                console.log('✅ PASS: Tenant B sees only Patient B.');
            } else {
                console.error('❌ FAIL: Tenant B saw unexpected data:', patients);
            }
        });

    } catch (error) {
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('\nCleaning up...');
        // Cleanup (Cascades to patients)
        if (tenantA_id) await db.deleteFrom('tenants').where('id', '=', tenantA_id).execute();
        if (tenantB_id) await db.deleteFrom('tenants').where('id', '=', tenantB_id).execute();

        await db.destroy();
        console.log('✅ Cleanup complete.');
    }
}

testMultitenancy();
