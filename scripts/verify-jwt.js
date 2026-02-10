require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');
const jwt = require('jsonwebtoken'); // Assuming user has this locally, or we use decoded from response
// Wait, we can't require jwt if it's not installed in the script dir, but it's in node_modules of project.
// We are running this script with node in the project root found in CWD.

// We need a running server for this test?
// The previous verification scripts were pure DB.
// This one tests Middleware, so it needs a RUNNING SERVER or we mock it.
// Simulating middleware logic is easier than starting server.
// But better to test end-to-end if possible.
// The user has `npm run dev` running. We can try to hit localhost:3000.
// Let's assume server is running on 3000.

const API_URL = 'http://localhost:3000/api';

async function verifyJWTFlow() {
    console.log('🧪 Starting JWT Tenant Verification...');

    try {
        // 1. Login (assuming we have a user from previous seeds/tests)
        // We can use the global test user we might have created, or create one.
        // Let's create a user directly in DB first to be sure.
        // OR verify-global-email.js created one? It cleaned up.
        // Let's insert a fresh tenant and user.

        // Actually, let's use the DB code to setup, then axios to test.
        const db = require('../src/config/database');
        const { sql } = require('kysely');
        const crypto = require('crypto');
        const bcrypt = require('bcryptjs');

        const email = `jwtuser_${crypto.randomBytes(4).toString('hex')}@example.com`;
        const password = 'password123';
        const password_hash = await bcrypt.hash(password, 10);
        const tenant_name = 'JWT Tenant';
        const tenant_code = 'jwt' + crypto.randomBytes(2).toString('hex');

        let tenant_id, user_id;

        // Setup
        console.log('Creating Tenant and User...');
        tenant_id = (await db.insertInto('tenants').values({
            name: tenant_name,
            subdomain: tenant_code,
            subscription_status: 'tenant.status.active',
            is_active: true
        }).returning('id').executeTakeFirst()).id;

        await db.connection().execute(async (trx) => {
            await sql`SELECT set_config('app.current_tenant', ${tenant_id}::text, true)`.execute(trx);
            const user = await trx.insertInto('users').values({
                tenant_id: tenant_id,
                email: email,
                password_hash,
                full_name: 'JWT Tester',
                role_id: 1, // Admin
                status_key: 'user.status.active'
            }).returning('id').executeTakeFirst();
            user_id = user.id;
        });
        console.log(`User created: ${email}`);

        // Test Login
        console.log('Attempting Login...');
        try {
            const loginRes = await axios.post(`${API_URL}/auth/login`, {
                email,
                password
            });

            const { token, tenantId } = loginRes.data;
            console.log('Login successful.');
            console.log(`Token received: ${token.substring(0, 20)}...`);
            console.log(`Tenant ID from response: ${tenantId}`);

            if (tenantId !== tenant_id) {
                console.error('❌ FAIL: Returned Tenant ID does not match.');
            } else {
                console.log('✅ PASS: Login returned correct Tenant ID.');
            }

            // Verify Token Payload has tenant_id
            // We can decode to check (checking client side logic essentially)
            const parts = token.split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            if (payload.tenant_id === tenant_id) {
                console.log('✅ PASS: JWT Payload contains correct tenant_id.');
            } else {
                console.error('❌ FAIL: JWT Payload missing or incorrect tenant_id.', payload);
            }

            // Test Authenticated Request WITHOUT header
            console.log('Testing Authenticated Request (No Header)...');
            try {
                const profileRes = await axios.get(`${API_URL}/auth/validate`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                    // NO X-Tenant-ID header
                });
                console.log('Profile fetched successfully.');
                if (profileRes.data.id === user_id) {
                    console.log('✅ PASS: Middleware resolved tenant from JWT.');
                } else {
                    console.error('❌ FAIL: Profile ID mismatch.');
                }
            } catch (reqErr) {
                console.error('❌ FAIL: Authenticated request failed.', reqErr.response?.data || reqErr.message);
            }

        } catch (authErr) {
            console.error('❌ Login failed:', authErr.response?.data || authErr.message);
        } finally {
            console.log('Cleaning up...');
            if (tenant_id) await db.deleteFrom('tenants').where('id', '=', tenant_id).execute();
            await db.destroy();
        }

    } catch (err) {
        console.error('Test script error:', err);
    }
}

verifyJWTFlow();
