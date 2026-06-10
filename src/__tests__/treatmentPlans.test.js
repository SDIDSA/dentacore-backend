const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../app');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let authToken = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  if (res.statusCode !== 200) throw new Error('Login failed');
  authToken = res.body.accessToken;
});

describe('GET /api/v1/treatment-plans', () => {
  it('should return list of plans', async () => {
    const res = await request(app)
      .get('/api/v1/treatment-plans')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should support pagination with limit and offset', async () => {
    const res = await request(app)
      .get('/api/v1/treatment-plans?limit=5&offset=0')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
  });

  it('should support search by plan_name', async () => {
    const res = await request(app)
      .get('/api/v1/treatment-plans?search=test')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should support sort_by and sort_order', async () => {
    const res = await request(app)
      .get('/api/v1/treatment-plans?sort_by=plan_name&sort_order=asc')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/v1/treatment-plans', () => {
  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/treatment-plans')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});
