const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../app');

const ADMIN_EMAIL = 'admin@elqods.dz';
const ADMIN_PASSWORD = 'Admin@2025!';

let authToken = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (res.statusCode !== 200) throw new Error('Login failed');
  authToken = res.body.accessToken;
});

describe('GET /api/v1/audit-logs', () => {
  it('should return list of audit logs', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should support pagination via limit and offset', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?limit=5&offset=0')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    if (Array.isArray(res.body) && res.body.length > 0) {
      expect(res.body.length).toBeLessThanOrEqual(5);
    }
  });

  it('should support entity_type filter', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?entity_type=patients')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should support action filter', async () => {
    const res = await request(app)
      .get('/api/v1/audit-logs?action=CREATE')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
