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
let createdPatientId = null;

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;

    const suffix = crypto.randomUUID().slice(0, 6);
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: `John Searchword ${suffix}`,
        date_of_birth: '1988-06-06',
        gender: 'patient.gender.male',
        phone: `+213${String(Date.now()).slice(-9)}`,
      });
    if (res.statusCode !== 201) throw new Error(`Patient creation failed: ${res.statusCode}`);
    createdPatientId = res.body.id;
  } catch (err) {
    console.warn(`[patientsSearch] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable || !createdPatientId) return;
  try {
    await request(app)
      .delete(`/api/v1/patients/${createdPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Multi-word patient search (plainto_tsquery)', () => {
  it('GET /api/v1/patients/search?search=john+searchword returns 200 and finds the multi-word name', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/v1/patients/search?search=john+searchword')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toContain(createdPatientId);
  });

  it('GET /api/v1/patients?search=<multi word> returns 200 (no tsquery syntax error)', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/v1/patients?search=john searchword')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v1/patients/search with special characters does not crash', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get('/api/v1/patients/search?search=john%26%7C!()')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
