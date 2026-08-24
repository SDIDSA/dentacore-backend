const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const fs = require('fs');
const app = require('../app');

// db.sql lives at the backend root — its contents must never be served
const DB_SQL_MARKER = 'CREATE TABLE';

describe('Updates endpoint path traversal guard', () => {
  it('GET /api/v1/updates/download with an encoded ../ filename returns 400/404, never file contents', async () => {
    const res = await request(app)
      .get('/api/v1/updates/download/%2e%2e%2fdb.sql');

    expect([400, 404]).toContain(res.statusCode);
    expect(res.text || '').not.toContain(DB_SQL_MARKER);
  });

  it('GET /api/v1/updates/download with a raw ../ path never serves db.sql', async () => {
    const res = await request(app)
      .get('/api/v1/updates/download/../db.sql');

    expect(res.statusCode).not.toBe(200);
    expect(res.text || '').not.toContain(DB_SQL_MARKER);
  });

  it('GET a legit-looking nonexistent filename returns a 4xx error without crashing', async () => {
    const res = await request(app)
      .get('/api/v1/updates/download/nonexistent.exe');

    expect([400, 404]).toContain(res.statusCode);
    expect(res.text || '').not.toContain(DB_SQL_MARKER);
  });

  it('GET /api/v1/updates/version returns 404 JSON when version.json is absent', async () => {
    const versionFile = path.resolve(__dirname, '../../updates/version.json');
    if (fs.existsSync(versionFile)) {
      return; // environment has a version.json; absence cannot be asserted
    }
    const res = await request(app).get('/api/v1/updates/version');

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('update.not_found');
  });
});
