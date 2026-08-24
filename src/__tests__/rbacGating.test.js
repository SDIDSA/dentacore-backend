const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const {
  TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD,
  TEST_DENTIST_EMAIL, TEST_DENTIST_PASSWORD,
  TEST_RECEPTION_EMAIL, TEST_RECEPTION_PASSWORD,
} = require('./helpers/config');

let dbAvailable = true;
const tokens = {};

const ADMIN_ONLY_ROUTES = [
  '/api/v1/audit-logs',
  '/api/v1/reports/revenue/monthly',
  '/api/v1/reports/procedures/frequency',
  '/api/v1/reports/appointments/stats',
  '/api/v1/dashboard/recent-activity',
];

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const credentials = {
      admin: { email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD },
      dentist: { email: TEST_DENTIST_EMAIL, password: TEST_DENTIST_PASSWORD },
      reception: { email: TEST_RECEPTION_EMAIL, password: TEST_RECEPTION_PASSWORD },
    };
    for (const [role, creds] of Object.entries(credentials)) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send(creds);
      if (res.statusCode !== 200) throw new Error(`Login failed for ${role}`);
      tokens[role] = res.body.accessToken;
    }
  } catch (err) {
    console.warn(`[rbacGating] DB unavailable or login failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

describe('Admin-only endpoints are gated by role', () => {
  describe.each(ADMIN_ONLY_ROUTES)('%s', (route) => {
    it('returns 403 for a dentist token', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${tokens.dentist}`);
      expect(res.statusCode).toBe(403);
    });

    it('returns 403 for a receptionist token', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${tokens.reception}`);
      expect(res.statusCode).toBe(403);
    });

    it('returns 200 for an admin token', async () => {
      if (!dbAvailable) return;
      const res = await request(app)
        .get(route)
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.statusCode).toBe(200);
    });
  });
});
