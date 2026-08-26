// Platform administration regression tests.
//
// Exercises the /api/v1/platform surface: role gating (clinic admin and
// anonymous requests must be rejected; only auth.role.platform_admin passes),
// platform stats, tenant listing with search/status filters, tenant detail
// with users, and subscription PATCH validation + effects.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('../config/database');
const { loginAs, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

function uuidv4() { return crypto.randomUUID(); }

let dbAvailable = true;
let ctx;

beforeAll(async () => {
  try {
    await db.selectFrom('tenants').select('id').limit(1).execute();
  } catch (e) {
    dbAvailable = false;
    return;
  }

  const suffix = uuidv4().slice(0, 8);

  // platform operator tenant + user
  const [ptenant] = await db.insertInto('tenants').values({
    name: `Platform ${suffix}`,
    subdomain: `platform-${suffix}`,
    subscription_status: 'tenant.status.active',
    subscription_plan: 'platform',
  }).returningAll().execute();

  const roles = await db.selectFrom('roles').select(['id', 'role_key']).execute();
  const roleId = Object.fromEntries(roles.map((r) => [r.role_key, r.id]));

  await db.insertInto('users').values({
    tenant_id: ptenant.id,
    role_id: roleId['auth.role.platform_admin'],
    email: `operator-${suffix}@platform.test`,
    password_hash: bcrypt.hashSync('Platform@2026!', 10),
    full_name: 'Operator',
    phone: `+213${String(Date.now()).slice(-9)}`,
  }).execute();

  // a regular clinic tenant (the signup flow's own tests cover its creation;
  // here we insert directly for isolation)
  const [clinic] = await db.insertInto('tenants').values({
    name: `Clinic ${suffix}`,
    subdomain: `pc-${suffix}`,
    subscription_status: 'tenant.status.trial',
  }).returningAll().execute();

  await db.insertInto('users').values({
    tenant_id: clinic.id,
    role_id: roleId['auth.role.admin'],
    email: `padmin-${suffix}@test.dz`,
    password_hash: bcrypt.hashSync('Clinic@2026!', 10),
    full_name: 'Clinic Admin',
    phone: `+213${String(Date.now()).slice(-9)}`,
  }).execute();

  ctx = {
    suffix,
    platformTenantId: ptenant.id,
    platformEmail: `operator-${suffix}@platform.test`,
    clinicTenantId: clinic.id,
    clinicSubdomain: `pc-${suffix}`,
    clinicName: `Clinic ${suffix}`,
  };
});

afterAll(async () => {
  if (dbAvailable && ctx) {
    await db.deleteFrom('tenants').where('id', 'in', [ctx.platformTenantId, ctx.clinicTenantId]).execute();
  }
});

describe('platform route gating', () => {
  const base = '/api/v1/platform';

  it('rejects anonymous requests', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants`);
    expect(res.statusCode).toBe(401);
  });

  it('rejects clinic admins with 403', async () => {
    if (!dbAvailable) return;
    const token = await loginAs(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const res = await request(app).get(`${base}/tenants`).set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(403);
  });
});

describe('platform admin surface', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => {
    if (!dbAvailable) return;
    token = await loginAs(app, ctx.platformEmail, 'Platform@2026!');
  });

  it('reports platform stats', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/stats`).set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.tenants.total).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.users).toBe('number');
    expect(typeof res.body.patients).toBe('number');
    expect(typeof res.body.appointments).toBe('number');
  });

  it('lists tenants with usage counts', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`${base}/tenants`).set('Authorization', `Bearer ${token}`)
      .query({ search: ctx.clinicSubdomain });
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(1);
    const row = res.body.tenants[0];
    expect(row.subdomain).toBe(ctx.clinicSubdomain);
    expect(row.user_count).toBe(1);
    expect(row.subscription_status).toBe('tenant.status.trial');
  });

  it('filters by status', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`${base}/tenants`).set('Authorization', `Bearer ${token}`)
      .query({ status: 'trial', search: ctx.clinicName });
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('returns tenant detail with users', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/${ctx.clinicTenantId}`).set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.subdomain).toBe(ctx.clinicSubdomain);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].role_key).toBe('auth.role.admin');
  });

  it('404s unknown tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/${uuidv4()}`).set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });

  it('updates the subscription (PATCH)', async () => {
    if (!dbAvailable) return;
    const ends = new Date(Date.now() + 365 * 86400000).toISOString();
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set('Authorization', `Bearer ${token}`)
      .send({ subscription_status: 'tenant.status.active', subscription_plan: 'clinic', subscription_ends_at: ends });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.subscription_status).toBe('tenant.status.active');
    expect(res.body.tenant.subscription_plan).toBe('clinic');

    const check = await db.selectFrom('tenants')
      .select('subscription_status')
      .where('id', '=', ctx.clinicTenantId)
      .executeTakeFirst();
    expect(check.subscription_status).toBe('tenant.status.active');
  });

  it('rejects invalid subscription statuses', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set('Authorization', `Bearer ${token}`)
      .send({ subscription_status: 'tenant.status.gold' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty PATCH bodies', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });

  it('rejects malformed tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/not-a-uuid`).set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(400);
  });
});
