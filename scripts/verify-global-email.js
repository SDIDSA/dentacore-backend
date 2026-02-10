require('dotenv').config();
const db = require('../src/config/database');
const { sql } = require('kysely');
const crypto = require('crypto');

async function verifyGlobalEmail() {
    console.log('🧪 Starting Global Email & Discovery Verification...');

    const email = `testuser_${crypto.randomBytes(4).toString('hex')}@example.com`;
    const tenantA_name = 'Tenant Global A';
    const tenantA_code = 'globala' + crypto.randomBytes(2).toString('hex');
    const tenantB_name = 'Tenant Global B';
    const tenantB_code = 'globalb' + crypto.randomBytes(2).toString('hex');

    let tenantA_id, tenantB_id;

    try {
        // 1. Create Tenant A & B
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

        console.log(`✅ Tenants created: ${tenantA_code}, ${tenantB_code}`);

        // 2. Create User in Tenant A
        const password_hash = '$2a$12$K./z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z.z'; // Fake hash

        // We need to bypass RLS to insert users or use set_tenant_context
        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenantA_id}::text, true)`.execute(trx);

            await trx.insertInto('users').values({
                tenant_id: tenantA_id,
                email: email,
                password_hash,
                full_name: 'Test Global User',
                role_id: 1, // Assumptions: role id 1 exists
                status_key: 'user.status.active'
            }).execute();
        });
        console.log(`✅ User created in Tenant A with email: ${email}`);

        // 3. Test Discovery
        const discovery = await sql`SELECT get_tenant_id_by_email(${email}) as tenant_id`.execute(db);
        if (discovery.rows.length > 0 && discovery.rows[0].tenant_id === tenantA_id) {
            console.log('✅ PASS: Tenant Discovery successful.');
        } else {
            console.error('❌ FAIL: Tenant Discovery failed.', discovery.rows);
        }

        // 4. Test Global Uniqueness (Try creating same email in Tenant B)
        console.log('Testing Global Uniqueness (Expect Failure)...');
        try {
            await db.connection().execute(async (trx) => {
                await sql`SELECT set_config('app.current_tenant', ${tenantB_id}::text, true)`.execute(trx);

                await trx.insertInto('users').values({
                    tenant_id: tenantB_id,
                    email: email, // SAME EMAIL
                    password_hash,
                    full_name: 'Duplicate User',
                    role_id: 1,
                    status_key: 'user.status.active'
                }).execute();
            });
            console.error('❌ FAIL: Duplicate email was allowed!');
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                console.log('✅ PASS: Duplicate email rejected across tenants.');
            } else {
                console.error('❌ FAIL: Unexpected error:', error);
            }
        }

    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        console.log('\nCleaning up...');
        if (tenantA_id) await db.deleteFrom('tenants').where('id', '=', tenantA_id).execute();
        if (tenantB_id) await db.deleteFrom('tenants').where('id', '=', tenantB_id).execute();
        await db.destroy();
        console.log('✅ Cleanup complete.');
    }
}

verifyGlobalEmail();
