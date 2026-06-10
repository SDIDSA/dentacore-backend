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

describe('GET /api/v1/dashboard', () => {
  it('GET /appointments/today should return today appointments', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/appointments/today')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /recent-activity should return activity log', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/recent-activity')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /patients/raw should return raw patient data', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/patients/raw')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('patients');
    expect(Array.isArray(res.body.patients)).toBe(true);
  });

  it('GET /appointments/raw should return raw appointment data', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/appointments/raw')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('appointments');
    expect(Array.isArray(res.body.appointments)).toBe(true);
  });

  it('GET /treatments/raw should return raw treatment data', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/treatments/raw')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('treatments');
    expect(Array.isArray(res.body.treatments)).toBe(true);
  });

  it('GET /payments/raw should return raw payment data', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/payments/raw')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('payments');
    expect(Array.isArray(res.body.payments)).toBe(true);
  });
});
