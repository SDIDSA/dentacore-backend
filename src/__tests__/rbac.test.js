const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../app');

const CREDENTIALS = {
  admin: { email: 'admin@elqods.dz', password: 'Admin@2025!', role: 'auth.role.admin' },
  dentist: { email: 'dentist@elqods.dz', password: 'Dentist@2025!', role: 'auth.role.dentist' },
  reception: { email: 'reception@elqods.dz', password: 'Recept@2025!', role: 'auth.role.receptionist' },
};

const tokens = {};

beforeAll(async () => {
  for (const [role, creds] of Object.entries(CREDENTIALS)) {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send(creds);
    if (res.statusCode !== 200) throw new Error(`Login failed for ${role}`);
    tokens[role] = res.body.accessToken;
  }
});

describe('RBAC authorization', () => {
  describe('Admin access', () => {
    it('should access patient list', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.statusCode).toBe(200);
    });

    it('should access audit logs', async () => {
      const res = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.statusCode).toBe(200);
    });

    it('should access user management', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Dentist access', () => {
    it('should access patient list', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${tokens.dentist}`);
      expect(res.statusCode).toBe(200);
    });

    it('should access treatment plans', async () => {
      const res = await request(app)
        .get('/api/v1/treatment-plans')
        .set('Authorization', `Bearer ${tokens.dentist}`);
      expect(res.statusCode).toBe(200);
    });

    it('should create treatment records', async () => {
      const patRes = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${tokens.dentist}`);
      if (patRes.body.length === 0) return;
      const res = await request(app)
        .post('/api/v1/treatments')
        .set('Authorization', `Bearer ${tokens.dentist}`)
        .send({
          patient_id: patRes.body[0],
          dentist_id: (await request(app).get('/api/v1/users').set('Authorization', `Bearer ${tokens.dentist}`)).body[0],
          treatment_date: new Date().toISOString(),
          diagnosis: 'RBAC test diagnosis',
          treatment_performed: 'RBAC test procedure',
          estimated_cost_dzd: 1000,
        });
      expect(res.statusCode).toBe(201);
    });
  });

  describe('Receptionist access', () => {
    it('should access patient list', async () => {
      const res = await request(app)
        .get('/api/v1/patients')
        .set('Authorization', `Bearer ${tokens.reception}`);
      expect(res.statusCode).toBe(200);
    });

    it('should access appointments', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .set('Authorization', `Bearer ${tokens.reception}`);
      expect(res.statusCode).toBe(200);
    });

    it('should access today appointments', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/appointments/today')
        .set('Authorization', `Bearer ${tokens.reception}`);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Auth validation', () => {
    it('should validate admin token with proper role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${tokens.admin}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.roleKey).toBe('auth.role.admin');
    });

    it('should validate dentist token with proper role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${tokens.dentist}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.roleKey).toBe('auth.role.dentist');
    });

    it('should validate receptionist token with proper role', async () => {
      const res = await request(app)
        .get('/api/v1/auth/validate')
        .set('Authorization', `Bearer ${tokens.reception}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.roleKey).toBe('auth.role.receptionist');
    });
  });
});
