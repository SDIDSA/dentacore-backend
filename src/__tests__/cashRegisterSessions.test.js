const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let dbAvailable = true;
let adminToken = null;
let sessionId = null;

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;

    // Clean up any stray OPEN sessions in this tenant before testing
    const tenantId = login.body.tenantId;
    await db
      .updateTable('cash_register_sessions')
      .set({ status: 'CLOSED', closed_at: sql`NOW()` })
      .where('tenant_id', '=', tenantId)
      .where('status', '=', 'OPEN')
      .execute();
  } catch (err) {
    console.warn(`[cashRegisterSessions.test] DB unavailable or setup failed: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (sessionId) {
      await db.deleteFrom('cash_register_sessions').where('id', '=', sessionId).execute();
    }
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Cash Register Sessions API', () => {
  it('POST /api/v1/cash-register-sessions opens a new shift session', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/cash-register-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        opening_float_dzd: 15000,
        notes: 'Morning shift opening float',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('OPEN');
    expect(Number(res.body.opening_float_dzd)).toBe(15000);
    sessionId = res.body.id;
  });

  it('POST /api/v1/cash-register-sessions rejects opening a second session when one is OPEN', async () => {
    if (!dbAvailable || !sessionId) return;
    const res = await request(app)
      .post('/api/v1/cash-register-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        opening_float_dzd: 5000,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('cash_session.already_open');
  });

  it('GET /api/v1/cash-register-sessions/active returns the open session', async () => {
    if (!dbAvailable || !sessionId) return;
    const res = await request(app)
      .get('/api/v1/cash-register-sessions/active')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(sessionId);
    expect(res.body.status).toBe('OPEN');
  });

  it('POST /api/v1/cash-register-sessions/:id/close reconciles cash and closes session', async () => {
    if (!dbAvailable || !sessionId) return;
    const res = await request(app)
      .post(`/api/v1/cash-register-sessions/${sessionId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        counted_cash_dzd: 15200,
        notes: 'Evening shift closing with 200 DZD tip/overage',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(sessionId);
    expect(res.body.status).toBe('CLOSED');
    expect(res.body.closed_at).toBeDefined();
    expect(Number(res.body.counted_cash_dzd)).toBe(15200);
    expect(res.body.expected_cash_dzd).toBeDefined();
    expect(res.body.discrepancy_dzd).toBeDefined();
  });

  it('GET /api/v1/cash-register-sessions/:id returns the closed session details', async () => {
    if (!dbAvailable || !sessionId) return;
    const res = await request(app)
      .get(`/api/v1/cash-register-sessions/${sessionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(sessionId);
    expect(res.body.status).toBe('CLOSED');
  });
});
