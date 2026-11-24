const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const app = require('../app');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let adminToken = null;
let createdCrashId = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
  if (res.statusCode !== 200) throw new Error('Admin login failed for clientLogs test');
  adminToken = res.body.accessToken;
});

describe('Client Logs & Remote Crash Tracking API', () => {
  describe('POST /api/v1/client-logs (Ingestion)', () => {
    it('should successfully log unauthenticated crash report', async () => {
      const res = await request(app)
        .post('/api/v1/client-logs')
        .send({
          app_version: '0.9.20',
          platform: 'Windows',
          os_version: 'Windows 11 10.0',
          error_type: 'NullPointerException',
          message: 'Cannot invoke method on null object',
          stack_trace: 'java.lang.NullPointerException: Cannot invoke...\n\tat com.sdidsa.dentacore.app.Launcher.main(Launcher.java:7)',
          component: 'JavaFX-Application-Thread',
          device_info: { memoryMB: 4096, scale: 1.0 },
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('logged');
    });

    it('should successfully log authenticated crash report with JWT', async () => {
      const res = await request(app)
        .post('/api/v1/client-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          app_version: '0.9.20',
          platform: 'Android',
          os_version: 'Android 14',
          error_type: 'IllegalStateException',
          message: 'View detached from window',
          stack_trace: 'java.lang.IllegalStateException: View detached...\n\tat com.sdidsa.sera.MainActivity.onResume(MainActivity.java:42)',
          component: 'MainActivity',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('logged');
      createdCrashId = res.body.id;
    });

    it('should reject request missing required fields with 400', async () => {
      const res = await request(app)
        .post('/api/v1/client-logs')
        .send({
          app_version: '0.9.19',
          // missing platform, error_type, stack_trace
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });
  });

  describe('GET /api/v1/client-logs/stats', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/client-logs/stats');
      expect(res.statusCode).toBe(401);
    });

    it('should return aggregated stats for admin', async () => {
      const res = await request(app)
        .get('/api/v1/client-logs/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('unresolved');
      expect(res.body).toHaveProperty('last_24h');
      expect(res.body).toHaveProperty('by_platform');
      expect(res.body).toHaveProperty('top_errors');
      expect(Array.isArray(res.body.by_platform)).toBe(true);
      expect(Array.isArray(res.body.top_errors)).toBe(true);
    });
  });

  describe('GET /api/v1/client-logs', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/v1/client-logs');
      expect(res.statusCode).toBe(401);
    });

    it('should return paginated crash reports list', async () => {
      const res = await request(app)
        .get('/api/v1/client-logs?limit=10&page=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination.page).toBe(1);
    });

    it('should filter by search substring', async () => {
      const res = await request(app)
        .get('/api/v1/client-logs?search=IllegalState')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      for (const item of res.body.data) {
        expect(
          (item.error_type && item.error_type.includes('IllegalState')) ||
          (item.message && item.message.includes('IllegalState')) ||
          (item.stack_trace_preview && item.stack_trace_preview.includes('IllegalState'))
        ).toBe(true);
      }
    });

    it('should filter by resolved status', async () => {
      const res = await request(app)
        .get('/api/v1/client-logs?resolved=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      for (const item of res.body.data) {
        expect(item.resolved).toBe(false);
      }
    });
  });

  describe('GET /api/v1/client-logs/:id', () => {
    it('should retrieve full crash detail including stack trace', async () => {
      expect(createdCrashId).toBeTruthy();

      const res = await request(app)
        .get(`/api/v1/client-logs/${createdCrashId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(createdCrashId);
      expect(res.body).toHaveProperty('stack_trace');
      expect(res.body.error_type).toBe('IllegalStateException');
    });

    it('should return 404 for non-existent crash UUID', async () => {
      const res = await request(app)
        .get('/api/v1/client-logs/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/v1/client-logs/:id', () => {
    it('should mark crash report as resolved with notes', async () => {
      expect(createdCrashId).toBeTruthy();

      const res = await request(app)
        .patch(`/api/v1/client-logs/${createdCrashId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resolved: true,
          resolution_notes: 'Null check added in 0.9.20 release',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.resolved).toBe(true);
      expect(res.body.resolution_notes).toBe('Null check added in 0.9.20 release');
      expect(res.body.resolved_at).toBeTruthy();
    });
  });

  describe('DELETE /api/v1/client-logs/:id', () => {
    it('should delete a crash report', async () => {
      expect(createdCrashId).toBeTruthy();

      const res = await request(app)
        .delete(`/api/v1/client-logs/${createdCrashId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(204);

      // Verify deletion
      const check = await request(app)
        .get(`/api/v1/client-logs/${createdCrashId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.statusCode).toBe(404);
    });
  });
});
