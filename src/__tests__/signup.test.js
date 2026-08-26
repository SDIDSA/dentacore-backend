// Clinic self-signup regression tests.
//
// Exercises the unauthenticated POST /api/v1/signup surface: happy path
// (trial tenant + admin user, then a real login against the created
// credentials), subdomain/email conflicts, reserved slugs, and input
// validation (subdomain format, phone format, short passwords).
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');
const db = require('../config/database');

function uuidv4() { return crypto.randomUUID(); }

let dbAvailable = true;
const createdTenants = [];

beforeAll(async () => {
  try {
    await db.selectFrom('tenants').select('id').limit(1).execute();
  } catch (e) {
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (dbAvailable) {
    for (const id of createdTenants) {
      await db.deleteFrom('tenants').where('id', '=', id).execute();
    }
  }
});

describe('POST /api/v1/signup', () => {
  const base = '/api/v1/signup';

  function payload(over = {}) {
    const suffix = uuidv4().slice(0, 8);
    return Object.assign({
      clinic_name: `Signup Clinic ${suffix}`,
      subdomain: `signup-${suffix}`,
      full_name: `Admin ${suffix}`,
      email: `admin-${suffix}@signup-test.dz`,
      password: 'Signup@2026!',
      phone: `+213${String(Date.now()).slice(-9)}`,
    }, over);
  }

  it('creates a trial tenant + admin and the credentials can log in', async () => {
    if (!dbAvailable) return;
    const data = payload();
    const res = await request(app).post(base).send(data);
    expect(res.statusCode).toBe(201);
    expect(res.body.tenant.subdomain).toBe(data.subdomain);
    expect(res.body.tenant.name).toBe(data.clinic_name);
    expect(new Date(res.body.trial_ends_at).getTime()).toBeGreaterThan(Date.now());

    const [tenant] = await db
      .selectFrom('tenants')
      .selectAll()
      .where('subdomain', '=', data.subdomain)
      .execute();
    expect(tenant.subscription_status).toBe('tenant.status.trial');
    createdTenants.push(tenant.id);

    const [user] = await db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .select(['users.id', 'users.email', 'roles.role_key'])
      .where('users.tenant_id', '=', tenant.id)
      .execute();
    expect(user.role_key).toBe('auth.role.admin');
    expect(user.email).toBe(data.email);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: data.email, password: data.password });
    expect(login.statusCode).toBe(200);
    expect(login.body.roleKey).toBe('auth.role.admin');
    expect(login.body.tenantId).toBe(tenant.id);
  });

  it('rejects a taken subdomain with 409', async () => {
    if (!dbAvailable) return;
    const data = payload();
    const first = await request(app).post(base).send(data);
    expect(first.statusCode).toBe(201);
    const [tenant] = await db
      .selectFrom('tenants').select('id').where('subdomain', '=', data.subdomain).execute();
    createdTenants.push(tenant.id);

    const second = await request(app).post(base).send(payload({ subdomain: data.subdomain }));
    expect(second.statusCode).toBe(409);
    expect(second.body.error).toBe('signup.error.subdomain_taken');
  });

  it('rejects a taken email with 409', async () => {
    if (!dbAvailable) return;
    const data = payload();
    const first = await request(app).post(base).send(data);
    expect(first.statusCode).toBe(201);
    const [tenant] = await db
      .selectFrom('tenants').select('id').where('subdomain', '=', data.subdomain).execute();
    createdTenants.push(tenant.id);

    const second = await request(app).post(base).send(payload({ email: data.email }));
    expect(second.statusCode).toBe(409);
    expect(second.body.error).toBe('signup.error.email_taken');
  });

  it('rejects reserved slugs and malformed subdomains', async () => {
    if (!dbAvailable) return;
    for (const subdomain of ['www', 'api', 'has_underscore', '-lead', 'Has Upper']) {
      const res = await request(app).post(base).send(payload({ subdomain }));
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('validation.error');
    }
  });

  it('rejects bad phone and short passwords', async () => {
    if (!dbAvailable) return;
    const badPhone = await request(app).post(base).send(payload({ phone: '0555000111' }));
    expect(badPhone.statusCode).toBe(400);

    const shortPw = await request(app).post(base).send(payload({ password: 'short' }));
    expect(shortPw.statusCode).toBe(400);
  });
});
