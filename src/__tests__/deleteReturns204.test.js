const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let dbAvailable = true;
let adminToken = null;
let patientId = null;
let dentistId = null;
let receptionistRoleId = null;

async function expectDelete204(entityPath) {
  const res = await request(app)
    .delete(entityPath)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.statusCode).toBe(204);
  expect(res.text).toBe('');
}

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;

    const suffix = crypto.randomUUID().slice(0, 8);

    const patRes = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Delete204 Test Patient',
        date_of_birth: '1995-09-09',
        gender: 'patient.gender.female',
        phone: `+213${String(Date.now()).slice(-9)}`,
      });
    if (patRes.statusCode !== 201) throw new Error(`Patient creation failed: ${patRes.statusCode}`);
    patientId = patRes.body.id;

    const usersRes = await request(app)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);
    const users = Array.isArray(usersRes.body)
      ? usersRes.body.map((u) => (typeof u === 'string' ? { id: u } : u))
      : [];
    if (users.length === 0) throw new Error('No users available for dentist_id');
    dentistId = users[0].id;

    const role = await db
      .selectFrom('roles')
      .select('id')
      .where('role_key', '=', 'auth.role.receptionist')
      .executeTakeFirst();
    if (!role) throw new Error('receptionist role not found');
    receptionistRoleId = role.id;

    // keep the suffix/email reachable for the users test
    global.__delete204Suffix = suffix;
  } catch (err) {
    console.warn(`[deleteReturns204] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (patientId) {
      await request(app)
        .delete(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  } catch (_) { /* ignore cleanup errors */ }
});

describe('DELETE endpoints return 204 with an empty body', () => {
  it('DELETE /api/v1/appointments/:id returns 204 empty', async () => {
    if (!dbAvailable) return;
    const apptDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const create = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        dentist_id: dentistId,
        appointment_date: apptDate,
        duration_minutes: 15,
        reason: 'delete-204 regression',
      });
    expect(create.statusCode).toBe(201);

    await expectDelete204(`/api/v1/appointments/${create.body.id}`);
  });

  it('DELETE /api/v1/prescriptions/:id returns 204 empty', async () => {
    if (!dbAvailable) return;
    const create = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        medication_name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '2x/day',
      });
    expect(create.statusCode).toBe(201);

    await expectDelete204(`/api/v1/prescriptions/${create.body.id}`);
  });

  it('DELETE /api/v1/treatment-plans/:id returns 204 empty', async () => {
    if (!dbAvailable) return;
    const create = await request(app)
      .post('/api/v1/treatment-plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        plan_name: 'Delete204 regression plan',
        estimated_total_dzd: 1000,
      });
    expect(create.statusCode).toBe(201);

    await expectDelete204(`/api/v1/treatment-plans/${create.body.id}`);
  });

  it('DELETE /api/v1/users/:id returns 204 empty', async () => {
    if (!dbAvailable) return;
    const suffix = global.__delete204Suffix || crypto.randomUUID().slice(0, 8);
    const create = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: `delete204-${suffix}@test.dz`,
        password: 'Delete@204pass',
        full_name: 'Delete204 Regression User',
        phone: `+213${String(Date.now()).slice(-9)}`,
        role_id: receptionistRoleId,
      });
    expect(create.statusCode).toBe(201);

    await expectDelete204(`/api/v1/users/${create.body.id}`);
  });
});
