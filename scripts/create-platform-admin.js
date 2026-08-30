// Creates or promotes the Sera platform owner account (auth.role.platform_admin).
// The platform admin manages ALL tenants via /api/v1/platform + /platform.html.
//
// Usage (from the backend folder, .env configured):
//   node scripts/create-platform-admin.js <email> <password> [full name]
// If the email exists as a clinic user, it is PROMOTED to platform admin
// (with confirmation). The account lives under the reserved 'sera-platform'
// tenant, which is created on first use.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

const PLATFORM_SUBDOMAIN = 'sera-platform';

(async () => {
  const [email, password, fullName] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: node scripts/create-platform-admin.js <email> <password> [full name]');
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ERROR: password must be at least 8 characters');
    process.exit(1);
  }

  // platform tenant (created on first use; subdomain reserved for the operator)
  let tenant = await db.selectFrom('tenants')
    .selectAll()
    .where('subdomain', '=', PLATFORM_SUBDOMAIN)
    .executeTakeFirst();
  if (!tenant) {
    [tenant] = await db.insertInto('tenants')
      .values({
        name: 'Sera Platform',
        subdomain: PLATFORM_SUBDOMAIN,
        subscription_status: 'tenant.status.active',
        subscription_plan: 'platform',
      })
      .returningAll()
      .execute();
    console.log(`created platform tenant (${tenant.id})`);
  }

  const role = await db.selectFrom('roles')
    .select('id')
    .where('role_key', '=', 'auth.role.platform_admin')
    .executeTakeFirst();
  if (!role) {
    console.error("ERROR: role 'auth.role.platform_admin' not found - apply db.sql first (psql -U dentacore -d dentacore -f db.sql)");
    process.exit(1);
  }

  const existing = await db.selectFrom('users')
    .selectAll()
    .where('email', '=', email)
    .executeTakeFirst();

  if (existing) {
    if (existing.tenant_id === tenant.id) {
      await db.updateTable('users')
        .set({ password_hash: bcrypt.hashSync(password, 10), status_key: 'user.status.active' })
        .where('id', '=', existing.id)
        .execute();
      await db.insertInto('user_roles')
        .values({ user_id: existing.id, role_id: role.id })
        .onConflictDoNothing()
        .execute();
      console.log(`platform admin credentials reset for ${email}`);
    } else {
      console.error(`ERROR: ${email} already belongs to a clinic tenant.`);
      console.error('Choose a different email, or delete that user first from the clinic admin.');
      process.exit(1);
    }
  } else {
    const [newUser] = await db.insertInto('users')
      .values({
        tenant_id: tenant.id,
        email,
        password_hash: bcrypt.hashSync(password, 10),
        full_name: fullName || 'Sera Operator',
        phone: `+213${String(Date.now()).slice(-9)}`,
        status_key: 'user.status.active',
      })
      .returningAll()
      .execute();
    await db.insertInto('user_roles')
      .values({ user_id: newUser.id, role_id: role.id })
      .execute();
    console.log(`platform admin created: ${email}`);
  }

  console.log('Sign in at /platform.html');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
