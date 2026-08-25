// Seeds a demo clinic for the booking portal prototype and prints its slug.
// Usage: node scripts/seed-demo-clinic.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

(async () => {
  const suffix = 'demo';
  const existing = await db
    .selectFrom('tenants')
    .select('id')
    .where('subdomain', '=', `clinic-${suffix}`)
    .executeTakeFirst();
  if (existing) {
    console.log(`slug=clinic-${suffix} (already seeded)`);
    process.exit(0);
  }

  const [tenant] = await db
    .insertInto('tenants')
    .values({
      name: 'Clinique El Qods',
      subdomain: `clinic-${suffix}`,
      subscription_status: 'tenant.status.trial',
    })
    .returningAll()
    .execute();

  const roles = await db.selectFrom('roles').select(['id', 'role_key']).execute();
  const roleId = Object.fromEntries(roles.map((r) => [r.role_key, r.id]));

  const dentists = [
    { name: 'Dr. Amina Belkacem', email: `amina.${suffix}@demo.dz` },
    { name: 'Dr. Karim Haddad', email: `karim.${suffix}@demo.dz` },
  ];
  for (const d of dentists) {
    const [u] = await db
      .insertInto('users')
      .values({
        tenant_id: tenant.id,
        role_id: roleId['auth.role.dentist'],
        email: d.email,
        password_hash: bcrypt.hashSync(crypto.randomUUID(), 10),
        full_name: d.name,
        phone: `+213${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`,
      })
      .returningAll()
      .execute();

    // Sun–Thu 08:30-12:00 & 13:30-17:00, plus Sat morning (prototype variety)
    for (let dow = 0; dow <= 4; dow++) {
      await db.insertInto('working_hours').values([
        { tenant_id: tenant.id, dentist_id: u.id, day_of_week: dow, start_time: '08:30', end_time: '12:00', slot_minutes: 30 },
        { tenant_id: tenant.id, dentist_id: u.id, day_of_week: dow, start_time: '13:30', end_time: '17:00', slot_minutes: 30 },
      ]).execute();
    }
    await db.insertInto('working_hours').values({
      tenant_id: tenant.id, dentist_id: u.id, day_of_week: 6,
      start_time: '09:00', end_time: '12:00', slot_minutes: 20,
    }).execute();
  }

  console.log(`slug=clinic-${suffix}`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
