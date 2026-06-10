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

describe('GET /api/v1/reports', () => {
  it('GET /revenue/monthly should return monthly revenue data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue/monthly')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('total_revenue_dzd');
  });

  it('GET /revenue/monthly should accept months param', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue/monthly?months=3')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
  });

  it('GET /procedures/frequency should return procedure data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/procedures/frequency')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /patients/new should return new patient data', async () => {
    const res = await request(app)
      .get('/api/v1/reports/patients/new')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.summary).toHaveProperty('total_new_patients');
  });

  it('GET /appointments/stats should return appointment stats', async () => {
    const res = await request(app)
      .get('/api/v1/reports/appointments/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.summary).toHaveProperty('total_appointments');
  });

  it('GET /plans/summary should return plan summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/plans/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /revenue/by-method should return revenue by payment method', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue/by-method')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /dentist/stats should return per-dentist stats', async () => {
    const res = await request(app)
      .get('/api/v1/reports/dentist/stats')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /tax/summary should return VAT summary', async () => {
    const res = await request(app)
      .get('/api/v1/reports/tax/summary')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /revenue/export should return CSV', async () => {
    const res = await request(app)
      .get('/api/v1/reports/revenue/export')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });
});
