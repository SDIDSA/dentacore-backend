const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

function uuidv4() { return crypto.randomUUID(); }
function uniquePhone() { return `+213${String(Date.now()).slice(-9)}`; }

let dbAvailable = true;
let adminToken = null;
let tenant1Id = null;
let tenant2Id = null;
let user2 = null;
let user2Token = null;
let patient1 = null;
let patient2 = null;
let appointment1 = null;
let appointment2 = null;
let treatment1 = null;

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;
    tenant1Id = login.body.tenantId;

    const suffix = uuidv4().slice(0, 8);

    // Second tenant + admin user created directly via Kysely
    const [tenant2] = await db
      .insertInto('tenants')
      .values({
        name: `Regression Tenant ${suffix}`,
        subdomain: `regress-${suffix}`,
        subscription_status: 'tenant.status.trial',
      })
      .returningAll()
      .execute();
    tenant2Id = tenant2.id;

    const role = await db
      .selectFrom('roles')
      .select('id')
      .where('role_key', '=', 'auth.role.admin')
      .executeTakeFirst();
    if (!role) throw new Error('auth.role.admin role not found');

    const email2 = `regress-${suffix}@test.dz`;
    const password2 = 'Regress@2025!';
    [user2] = await db
      .insertInto('users')
      .values({
        tenant_id: tenant2Id,
        role_id: role.id,
        email: email2,
        password_hash: bcrypt.hashSync(password2, 10),
        full_name: `Regression Admin ${suffix}`,
        phone: uniquePhone(),
      })
      .returningAll()
      .execute();

    const user2Login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: email2, password: password2 });
    if (user2Login.statusCode !== 200) throw new Error('Second-tenant login failed');
    user2Token = user2Login.body.accessToken;

    // One first-tenant patient + today's appointment (raw SQL-level inserts)
    [patient1] = await db
      .insertInto('patients')
      .values({
        tenant_id: tenant1Id,
        full_name: `CrossTenant Secret ${suffix}`,
        date_of_birth: '1990-01-01',
        gender: 'patient.gender.male',
        phone: uniquePhone(),
      })
      .returningAll()
      .execute();

    const tenant1User = await db
      .selectFrom('users')
      .select('id')
      .where('tenant_id', '=', tenant1Id)
      .limit(1)
      .executeTakeFirst();
    if (!tenant1User) throw new Error('No seeded user in first tenant');

    [appointment1] = await db
      .insertInto('appointments')
      .values({
        tenant_id: tenant1Id,
        patient_id: patient1.id,
        dentist_id: tenant1User.id,
        appointment_date: new Date(),
        duration_minutes: 30,
        status_key: 'appt.status.scheduled',
        reason: 'cross-tenant regression probe t1',
      })
      .returningAll()
      .execute();

    [treatment1] = await db
      .insertInto('treatment_records')
      .values({
        tenant_id: tenant1Id,
        patient_id: patient1.id,
        dentist_id: tenant1User.id,
        treatment_date: new Date(),
        diagnosis: 'cross-tenant regression diagnosis',
        treatment_performed: 'cross-tenant regression treatment',
        estimated_cost_dzd: 5000,
      })
      .returningAll()
      .execute();

    // One second-tenant patient + today's appointment
    [patient2] = await db
      .insertInto('patients')
      .values({
        tenant_id: tenant2Id,
        full_name: `CrossTenant Own ${suffix}`,
        date_of_birth: '1991-02-02',
        gender: 'patient.gender.female',
        phone: uniquePhone(),
      })
      .returningAll()
      .execute();

    [appointment2] = await db
      .insertInto('appointments')
      .values({
        tenant_id: tenant2Id,
        patient_id: patient2.id,
        dentist_id: user2.id,
        appointment_date: new Date(),
        duration_minutes: 30,
        status_key: 'appt.status.scheduled',
        reason: 'cross-tenant regression probe t2',
      })
      .returningAll()
      .execute();
  } catch (err) {
    console.warn(`[crossTenantIsolation] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (appointment1) await db.deleteFrom('appointments').where('id', '=', appointment1.id).execute();
    if (appointment2) await db.deleteFrom('appointments').where('id', '=', appointment2.id).execute();
    if (treatment1) await db.deleteFrom('treatment_records').where('id', '=', treatment1.id).execute();
    if (tenant2Id) await db.deleteFrom('tenants').where('id', '=', tenant2Id).execute(); // cascades user2/patient2
    if (patient1) await db.deleteFrom('patients').where('id', '=', patient1.id).execute();
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Cross-tenant isolation', () => {
  it('GET /dashboard/appointments/today returns only second-tenant rows', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/v1/dashboard/appointments/today')
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((a) => a.id);
    expect(ids).toContain(appointment2.id);
    expect(ids).not.toContain(appointment1.id);
  });

  it('POST /prescriptions referencing a first-tenant patient returns 400 and leaks no PII', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        patient_id: patient1.id,
        medication_name: 'Ibuprofen',
        dosage: '400mg',
        frequency: '3x/day',
      });

    expect([400, 404]).toContain(res.statusCode);
    expect(JSON.stringify(res.body)).not.toContain(patient1.full_name);
    expect(JSON.stringify(res.body)).not.toContain(patient1.phone);
  });

  // invoices.js POST validates that patient_id belongs to req.tenantId
  // (generic validation.error, no PII echo) before writing.
  it('POST /invoices referencing a first-tenant patient returns 400/404 and leaks no PII', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        patient_id: patient1.id,
        issue_date: new Date().toISOString(),
        line_items: [{ description: 'Consultation', quantity: 1, unit_price_dzd: 5000 }],
      });

    expect([400, 404]).toContain(res.statusCode);
    expect(JSON.stringify(res.body)).not.toContain(patient1.full_name);
  });

  // invoices.js POST validates line_items[].treatment_record_id belongs to
  // req.tenantId (generic validation.error, no PII echo) before writing.
  it('POST /invoices with a line item referencing a first-tenant treatment returns 400', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        patient_id: patient2.id,
        issue_date: new Date().toISOString(),
        line_items: [{
          description: 'Consultation',
          quantity: 1,
          unit_price_dzd: 5000,
          treatment_record_id: treatment1.id,
        }],
      });

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain(patient1.full_name);
  });

  // treatments.js POST validates every accepted entity reference
  // (patient_id, dentist_id, appointment_id, plan_id, category_id).
  it('POST /treatments referencing a first-tenant patient returns 400 and leaks no PII', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/treatments')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        patient_id: patient1.id,
        diagnosis: 'regression probe',
        treatment_performed: 'regression probe',
        estimated_cost_dzd: 3000,
      });

    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain(patient1.full_name);
  });

  it('GET of a first-tenant patient id by the second-tenant user returns 404', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`/api/v1/patients/${patient1.id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(patient1.full_name);
  });

  it('GET of a first-tenant appointment id by the second-tenant user returns 404', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`/api/v1/appointments/${appointment1.id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.statusCode).toBe(404);
  });
});
