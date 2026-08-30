// Platform administration regression tests — full suite.
//
// Exercises every /api/v1/platform surface: role gating, stats, tenant
// CRUD, revenue, plans, invoices, analytics, bulk, audit, announcements,
// and impersonation.
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

  const [operator] = await db.insertInto('users').values({
    tenant_id: ptenant.id,
    email: `operator-${suffix}@platform.test`,
    password_hash: bcrypt.hashSync('Platform@2026!', 10),
    full_name: 'Operator',
    phone: `+213${String(Date.now()).slice(-9)}`,
  }).returning('id').execute();
  await db.insertInto('user_roles').values({ user_id: operator.id, role_id: roleId['auth.role.platform_admin'] }).execute();

  // a regular clinic tenant
  const [clinic] = await db.insertInto('tenants').values({
    name: `Clinic ${suffix}`,
    subdomain: `pc-${suffix}`,
    subscription_status: 'tenant.status.trial',
    subscription_plan: 'starter',
  }).returningAll().execute();

  const [clinicAdmin] = await db.insertInto('users').values({
    tenant_id: clinic.id,
    email: `padmin-${suffix}@test.dz`,
    password_hash: bcrypt.hashSync('Clinic@2026!', 10),
    full_name: 'Clinic Admin',
    phone: `+213${String(Date.now()).slice(-9)}`,
  }).returning('id').execute();
  await db.insertInto('user_roles').values({ user_id: clinicAdmin.id, role_id: roleId['auth.role.admin'] }).execute();

  ctx = {
    suffix,
    platformTenantId: ptenant.id,
    platformEmail: `operator-${suffix}@platform.test`,
    clinicTenantId: clinic.id,
    clinicSubdomain: `pc-${suffix}`,
    clinicName: `Clinic ${suffix}`,
    adminRoleId: roleId['auth.role.admin'],
    createdPlanId: null,
    createdInvoiceId: null,
    createdAnnouncementId: null,
  };
});

afterAll(async () => {
  if (!dbAvailable || !ctx) return;
  // cleanup in reverse dependency order
  if (ctx.createdAnnouncementId) {
    await db.deleteFrom('platform_announcements').where('id', '=', ctx.createdAnnouncementId).execute().catch(() => {});
  }
  if (ctx.createdInvoiceId) {
    await db.deleteFrom('platform_invoices').where('id', '=', ctx.createdInvoiceId).execute().catch(() => {});
  }
  if (ctx.createdPlanId) {
    await db.deleteFrom('platform_plans').where('id', '=', ctx.createdPlanId).execute().catch(() => {});
  }
  await db.deleteFrom('tenants').where('id', 'in', [ctx.platformTenantId, ctx.clinicTenantId]).execute();
});

// ---- helpers ---------------------------------------------------------------

function admin() {
  return loginAs(app, ctx.platformEmail, 'Platform@2026!');
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ============================================================================
// 1. ROLE GATING
// ============================================================================

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

// ============================================================================
// 2. STATS
// ============================================================================

describe('GET /platform/stats', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('reports platform stats', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/stats`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.tenants.total).toBeGreaterThanOrEqual(2);
    expect(typeof res.body.users).toBe('number');
    expect(typeof res.body.patients).toBe('number');
    expect(typeof res.body.appointments).toBe('number');
    expect(typeof res.body.tenants.active).toBe('number');
    expect(typeof res.body.tenants.trial).toBe('number');
    expect(typeof res.body.tenants.suspended).toBe('number');
    expect(typeof res.body.tenants.signups_30d).toBe('number');
  });
});

// ============================================================================
// 3. TENANT LIST + DETAIL + PATCH
// ============================================================================

describe('GET /platform/tenants', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('lists tenants with usage counts', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants`).set(authHeader(token)).query({ search: ctx.clinicSubdomain });
    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(1);
    const row = res.body.tenants[0];
    expect(row.subdomain).toBe(ctx.clinicSubdomain);
    expect(row.user_count).toBe(1);
    expect(row.subscription_status).toBe('tenant.status.trial');
    expect(typeof row.plan_id).toBeDefined();
  });

  it('filters by status', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants`).set(authHeader(token)).query({ status: 'trial' });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenants.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by plan', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants`).set(authHeader(token)).query({ plan: 'starter' });
    expect(res.statusCode).toBe(200);
  });

  it('paginates', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants`).set(authHeader(token)).query({ page: 1, limit: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenants.length).toBeLessThanOrEqual(1);
    expect(res.body.limit).toBe(1);
  });
});

describe('GET /platform/tenants/:id', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns tenant detail with users and revenue', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.subdomain).toBe(ctx.clinicSubdomain);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].role_key).toBe('auth.role.admin');
    expect(typeof res.body.tenant.total_billed).toBe('number');
    expect(typeof res.body.tenant.invoice_count).toBe('number');
  });

  it('404s unknown tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/${uuidv4()}`).set(authHeader(token));
    expect(res.statusCode).toBe(404);
  });

  it('rejects malformed tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/not-a-uuid`).set(authHeader(token));
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /platform/tenants/:id', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('updates the subscription', async () => {
    if (!dbAvailable) return;
    const ends = new Date(Date.now() + 365 * 86400000).toISOString();
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({ subscription_status: 'tenant.status.active', subscription_plan: 'clinic', subscription_ends_at: ends });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.subscription_status).toBe('tenant.status.active');
    expect(res.body.tenant.subscription_plan).toBe('clinic');

    // verify DB
    const check = await db.selectFrom('tenants').select('subscription_status').where('id', '=', ctx.clinicTenantId).executeTakeFirst();
    expect(check.subscription_status).toBe('tenant.status.active');

    // restore for other tests
    await request(app).patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({ subscription_status: 'tenant.status.trial', subscription_plan: 'starter' });
  });

  it('updates plan_id', async () => {
    if (!dbAvailable) return;
    // find a plan
    const [plan] = await db.selectFrom('platform_plans').select('id').limit(1).execute();
    if (!plan) return;
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({ plan_id: plan.id });
    expect(res.statusCode).toBe(200);
    expect(res.body.tenant.plan_id).toBe(plan.id);

    // restore
    await request(app).patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token)).send({ plan_id: null });
  });

  it('rejects invalid subscription statuses', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({ subscription_status: 'tenant.status.gold' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects empty PATCH bodies', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({});
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================================
// 4. REVENUE
// ============================================================================

describe('GET /platform/revenue', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns revenue summary', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/revenue`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.mrr).toBe('number');
    expect(typeof res.body.total_revenue).toBe('number');
    expect(typeof res.body.outstanding).toBe('number');
    expect(Array.isArray(res.body.monthly)).toBe(true);
    expect(Array.isArray(res.body.per_tenant)).toBe(true);
  });
});

// ============================================================================
// 5. PLANS CRUD
// ============================================================================

describe('Plans CRUD', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('GET /plans lists seeded plans', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/plans`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
    expect(res.body[0].name).toBe('free');
  });

  it('POST /plans creates a plan', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/plans`).set(authHeader(token)).send({
      name: `test-plan-${ctx.suffix}`,
      label: 'Test Plan',
      monthly_price_dzd: 10000,
      annual_price_dzd: 100000,
      max_users: 10,
      max_patients: 1000,
      features: ['feature1', 'feature2'],
      sort_order: 5,
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe(`test-plan-${ctx.suffix}`);
    expect(Number(res.body.monthly_price_dzd)).toBe(10000);
    ctx.createdPlanId = res.body.id;
  });

  it('PATCH /plans/:id updates a plan', async () => {
    if (!dbAvailable || !ctx.createdPlanId) return;
    const res = await request(app).patch(`${base}/plans/${ctx.createdPlanId}`).set(authHeader(token)).send({
      label: 'Updated Plan',
      monthly_price_dzd: 12000,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.label).toBe('Updated Plan');
  });

  it('DELETE /plans/:id deletes a plan', async () => {
    if (!dbAvailable || !ctx.createdPlanId) return;
    const res = await request(app).delete(`${base}/plans/${ctx.createdPlanId}`).set(authHeader(token));
    expect(res.statusCode).toBe(204);
    ctx.createdPlanId = null; // already deleted
  });

  it('POST /plans rejects missing fields', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/plans`).set(authHeader(token)).send({ name: 'x' });
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================================
// 6. INVOICES
// ============================================================================

describe('Invoices', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('POST /invoices creates an invoice', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/invoices`).set(authHeader(token)).send({
      tenant_id: ctx.clinicTenantId,
      amount_dzd: 35000,
      period_start: '2026-08-01T00:00:00Z',
      period_end: '2026-08-31T23:59:59Z',
      notes: 'Test invoice',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.invoice_number).toMatch(/^PLF-/);
    expect(Number(res.body.amount_dzd)).toBe(35000);
    ctx.createdInvoiceId = res.body.id;
  });

  it('GET /invoices lists invoices', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/invoices`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.invoices.length).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /invoices filters by tenant_id', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/invoices`).set(authHeader(token)).query({ tenant_id: ctx.clinicTenantId });
    expect(res.statusCode).toBe(200);
    expect(res.body.invoices.every(i => i.tenant_name === ctx.clinicName)).toBe(true);
  });

  it('GET /invoices filters by status', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/invoices`).set(authHeader(token)).query({ status: 'platform_invoice.draft' });
    expect(res.statusCode).toBe(200);
  });

  it('PATCH /invoices/:id updates status to sent', async () => {
    if (!dbAvailable || !ctx.createdInvoiceId) return;
    const res = await request(app).patch(`${base}/invoices/${ctx.createdInvoiceId}`).set(authHeader(token)).send({
      status: 'platform_invoice.sent',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('platform_invoice.sent');
    expect(res.body.issued_at).not.toBeNull();
  });

  it('PATCH /invoices/:id updates status to paid', async () => {
    if (!dbAvailable || !ctx.createdInvoiceId) return;
    const res = await request(app).patch(`${base}/invoices/${ctx.createdInvoiceId}`).set(authHeader(token)).send({
      status: 'platform_invoice.paid',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('platform_invoice.paid');
    expect(res.body.paid_at).not.toBeNull();
  });

  it('DELETE /invoices/:id deletes an invoice', async () => {
    if (!dbAvailable || !ctx.createdInvoiceId) return;
    const res = await request(app).delete(`${base}/invoices/${ctx.createdInvoiceId}`).set(authHeader(token));
    expect(res.statusCode).toBe(204);
    ctx.createdInvoiceId = null;
  });

  it('POST /invoices rejects invalid tenant_id', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/invoices`).set(authHeader(token)).send({
      tenant_id: uuidv4(),
      amount_dzd: 100,
      period_start: '2026-08-01T00:00:00Z',
      period_end: '2026-08-31T23:59:59Z',
    });
    expect(res.statusCode).toBe(404);
  });
});

// ============================================================================
// 7. ANALYTICS
// ============================================================================

describe('GET /platform/analytics', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns analytics data', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/analytics`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.signups)).toBe(true);
    expect(typeof res.body.distribution.total).toBe('number');
    expect(typeof res.body.distribution.active).toBe('number');
    expect(typeof res.body.distribution.trial).toBe('number');
    expect(typeof res.body.churn_90d).toBe('number');
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(Array.isArray(res.body.patient_growth)).toBe(true);
  });
});

// ============================================================================
// 8. BULK ACTIONS
// ============================================================================

describe('POST /platform/tenants/bulk', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('bulk suspend', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/tenants/bulk`).set(authHeader(token)).send({
      ids: [ctx.clinicTenantId],
      action: 'suspend',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);

    // verify
    const check = await db.selectFrom('tenants').select('subscription_status').where('id', '=', ctx.clinicTenantId).executeTakeFirst();
    expect(check.subscription_status).toBe('tenant.status.suspended');

    // restore
    await request(app).post(`${base}/tenants/bulk`).set(authHeader(token)).send({ ids: [ctx.clinicTenantId], action: 'activate' });
  });

  it('bulk activate', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/tenants/bulk`).set(authHeader(token)).send({
      ids: [ctx.clinicTenantId],
      action: 'activate',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.updated).toBe(1);

    // restore subscription_status to trial
    await request(app).patch(`${base}/tenants/${ctx.clinicTenantId}`).set(authHeader(token))
      .send({ subscription_status: 'tenant.status.trial', subscription_plan: 'starter' });
  });

  it('rejects empty ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/tenants/bulk`).set(authHeader(token)).send({ ids: [], action: 'suspend' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid action', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/tenants/bulk`).set(authHeader(token)).send({ ids: [ctx.clinicTenantId], action: 'delete' });
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================================
// 9. CSV EXPORT
// ============================================================================

describe('GET /platform/tenants/export', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns CSV', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/export`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Name,Subdomain,Status');
    expect(res.text).toContain(ctx.clinicSubdomain);
  });

  it('filters CSV by status', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/tenants/export`).set(authHeader(token)).query({ status: 'trial' });
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain(ctx.clinicSubdomain);
  });
});

// ============================================================================
// 10. AUDIT TRAIL
// ============================================================================

describe('GET /platform/audit', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns audit entries', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/audit`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    // our earlier PATCH operations should have generated audit entries
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by operator', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/audit`).set(authHeader(token)).query({ operator: ctx.platformEmail });
    expect(res.statusCode).toBe(200);
    expect(res.body.entries.every(e => e.operator_email === ctx.platformEmail)).toBe(true);
  });

  it('paginates', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/audit`).set(authHeader(token)).query({ page: 1, limit: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.body.entries.length).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// 11. ANNOUNCEMENTS
// ============================================================================

describe('Announcements', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('POST /announcements creates one', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/announcements`).set(authHeader(token)).send({
      title: `Test Announcement ${ctx.suffix}`,
      body: 'This is a test announcement body.',
      target: 'announcement.target.all',
      channel: 'announcement.channel.in_app',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.title).toBe(`Test Announcement ${ctx.suffix}`);
    ctx.createdAnnouncementId = res.body.id;
  });

  it('GET /announcements lists them', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/announcements`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.announcements.length).toBeGreaterThanOrEqual(1);
    expect(typeof res.body.total).toBe('number');
  });

  it('GET /announcements/:id returns detail with read_count', async () => {
    if (!dbAvailable || !ctx.createdAnnouncementId) return;
    const res = await request(app).get(`${base}/announcements/${ctx.createdAnnouncementId}`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe(`Test Announcement ${ctx.suffix}`);
    expect(typeof res.body.read_count).toBe('number');
  });

  it('DELETE /announcements/:id deletes', async () => {
    if (!dbAvailable || !ctx.createdAnnouncementId) return;
    const res = await request(app).delete(`${base}/announcements/${ctx.createdAnnouncementId}`).set(authHeader(token));
    expect(res.statusCode).toBe(204);
    ctx.createdAnnouncementId = null;
  });

  it('POST /announcements rejects missing title', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/announcements`).set(authHeader(token)).send({ body: 'no title' });
    expect(res.statusCode).toBe(400);
  });
});

// ============================================================================
// 12. IMPERSONATION
// ============================================================================

describe('POST /platform/impersonate/:tenantId', () => {
  const base = '/api/v1/platform';
  let token;

  beforeAll(async () => { if (dbAvailable) token = await admin(); });

  it('returns a temporary token for the clinic admin', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/impersonate/${ctx.clinicTenantId}`).set(authHeader(token));
    expect(res.statusCode).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.tenant.id).toBe(ctx.clinicTenantId);
    expect(res.body.user.role_key).toBe('auth.role.admin');
  });

  it('404s unknown tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/impersonate/${uuidv4()}`).set(authHeader(token));
    expect(res.statusCode).toBe(404);
  });

  it('rejects malformed tenant ids', async () => {
    if (!dbAvailable) return;
    const res = await request(app).post(`${base}/impersonate/not-a-uuid`).set(authHeader(token));
    expect(res.statusCode).toBe(400);
  });
});
