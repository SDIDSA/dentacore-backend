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
      .select(['users.id', 'users.email'])
      .where('users.tenant_id', '=', tenant.id)
      .execute();
    const [userRole] = await db
      .selectFrom('user_roles')
      .innerJoin('roles', 'user_roles.role_id', 'roles.id')
      .select('roles.role_key')
      .where('user_roles.user_id', '=', user.id)
      .execute();
    expect(userRole.role_key).toBe('auth.role.admin');
    expect(user.email).toBe(data.email);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: data.email, password: data.password });
    expect(login.statusCode).toBe(200);
    expect(login.body.roleKey).toBe('auth.role.admin');
    expect(login.body.tenantId).toBe(tenant.id);
  });

  it('allows multi-role assignment and blocks removing the last admin', async () => {
    if (!dbAvailable) return;
    const data = payload();
    const res = await request(app).post(base).send(data);
    expect(res.statusCode).toBe(201);
    const [tenant] = await db
      .selectFrom('tenants').select('id').where('subdomain', '=', data.subdomain).execute();
    createdTenants.push(tenant.id);

    const login = await request(app)
      .post('/api/v1/auth/login').send({ email: data.email, password: data.password });
    const token = login.body.accessToken;

    const rolesRes = await request(app)
      .get('/api/v1/users/meta/roles').set('Authorization', `Bearer ${token}`);
    const adminId = rolesRes.body.find((r) => r.role_key === 'auth.role.admin').id;
    const dentistId = rolesRes.body.find((r) => r.role_key === 'auth.role.dentist').id;

    // create a dentist-only user
    const dentist = await request(app)
      .post('/api/v1/users').set('Authorization', `Bearer ${token}`).send({
        email: `dentist-${uuidv4().slice(0, 8)}@signup-test.dz`,
        password: 'Dentist@2026!',
        full_name: 'Solo Dentist',
        phone: `+213${String(Date.now()).slice(-9)}`,
        role_ids: [dentistId],
      });
    expect(dentist.statusCode).toBe(201);

    // removing admin from the only admin user is blocked
    const [adminUser] = await db
      .selectFrom('users').select('id').where('tenant_id', '=', tenant.id)
      .where('email', '=', data.email).execute();
    const blocked = await request(app)
      .patch(`/api/v1/users/${adminUser.id}`).set('Authorization', `Bearer ${token}`)
      .send({ role_ids: [dentistId] });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.body.error).toBe('user.error.last_admin');

    // granting the admin a second (dentist) role is allowed — true multi-role
    const multi = await request(app)
      .patch(`/api/v1/users/${adminUser.id}`).set('Authorization', `Bearer ${token}`)
      .send({ role_ids: [adminId, dentistId] });
    expect(multi.statusCode).toBe(200);
    expect(multi.body.role_keys).toEqual(
      expect.arrayContaining(['auth.role.admin', 'auth.role.dentist']));
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
