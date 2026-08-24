require('dotenv').config();
const db = require('../src/config/database');
const crypto = require('crypto');

// Verifies the tenancy mechanism the app ACTUALLY relies on: explicit
// `WHERE tenant_id = ?` filters. There are no RLS policies installed, so
// set_config('app.current_tenant', ...) is a no-op and DB-level session
// isolation does NOT exist — this script proves the discriminator works,
// not that the database would protect tenants on its own.
//
// Exits non-zero if any check fails (CI-usable).

let failures = 0;

function check(name, condition, detail) {
    if (condition) {
        console.log(`✅ PASS: ${name}`);
    } else {
        failures++;
        console.error(`❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`);
    }
}

async function testMultitenancy() {
    console.log('🧪 Starting Multi-tenancy Verification...');

    const suffix = crypto.randomBytes(4).toString('hex');
    const codeA = 'testa' + suffix;
    const codeB = 'testb' + suffix;

    let tenantA_id, tenantB_id;

    try {
        tenantA_id = (await db.insertInto('tenants').values({
            name: 'TestTenant A',
            subdomain: codeA,
            subscription_status: 'tenant.status.active',
            is_active: true
        }).returning('id').executeTakeFirst()).id;

        tenantB_id = (await db.insertInto('tenants').values({
            name: 'TestTenant B',
            subdomain: codeB,
            subscription_status: 'tenant.status.active',
            is_active: true
        }).returning('id').executeTakeFirst()).id;

        console.log(`✅ Tenants created. IDs: ${tenantA_id}, ${tenantB_id}`);

        await db.insertInto('patients').values({
            tenant_id: tenantA_id,
            full_name: 'Patient A',
            patient_code: `PAT-A-${suffix}`,
            date_of_birth: '1990-01-01',
            gender: 'patient.gender.male',
            phone: '+213555000001',
            status_key: 'patient.status.active'
        }).execute();
        console.log('✅ Patient A created.');

        await db.insertInto('patients').values({
            tenant_id: tenantB_id,
            full_name: 'Patient B',
            patient_code: `PAT-B-${suffix}`,
            date_of_birth: '1990-01-01',
            gender: 'patient.gender.female',
            phone: '+213555000002',
            status_key: 'patient.status.active'
        }).execute();
        console.log('✅ Patient B created.');

        // Isolation check mirrors the app-layer filter: tenant-scoped select
        // must contain the tenant's own row and ZERO foreign-tenant rows.
        const aRows = await db.selectFrom('patients').selectAll()
            .where('tenant_id', '=', tenantA_id).execute();
        check('Tenant A sees its own patient',
            aRows.some(p => p.full_name === 'Patient A'));
        check('Tenant A sees no foreign patients',
            aRows.every(p => p.tenant_id === tenantA_id),
            JSON.stringify(aRows.map(p => p.tenant_id)));

        const bRows = await db.selectFrom('patients').selectAll()
            .where('tenant_id', '=', tenantB_id).execute();
        check('Tenant B sees its own patient',
            bRows.some(p => p.full_name === 'Patient B'));
        check('Tenant B sees no foreign patients',
            bRows.every(p => p.tenant_id === tenantB_id),
            JSON.stringify(bRows.map(p => p.tenant_id)));

        // Cross-tenant read by id must NOT be possible without the filter
        // (documents the raw-table reality; routes enforce the filter).
        const directRead = await db.selectFrom('patients').selectAll()
            .where('full_name', '=', 'Patient B').executeTakeFirst();
        check('Raw table access is NOT isolated (expected — app layer enforces)',
            directRead !== null && directRead.tenant_id === tenantB_id);

    } catch (error) {
        failures++;
        console.error('❌ Test failed with error:', error);
    } finally {
        console.log('\nCleaning up...');
        try {
            if (tenantA_id) await db.deleteFrom('tenants').where('id', '=', tenantA_id).execute();
            if (tenantB_id) await db.deleteFrom('tenants').where('id', '=', tenantB_id).execute();
        } catch (_) { /* best-effort cleanup */ }

        await db.destroy();

        if (failures > 0) {
            console.error(`\n❌ ${failures} check(s) failed.`);
            process.exit(1);
        }
        console.log('\n✅ All checks passed.');
    }
}

testMultitenancy();
