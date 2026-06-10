const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const TEST_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@elqods.dz';
const TEST_ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@2025!';
const TEST_DENTIST_EMAIL = process.env.TEST_DENTIST_EMAIL || 'dentist@elqods.dz';
const TEST_DENTIST_PASSWORD = process.env.TEST_DENTIST_PASSWORD || 'Dentist@2025!';
const TEST_RECEPTION_EMAIL = process.env.TEST_RECEPTION_EMAIL || 'reception@elqods.dz';
const TEST_RECEPTION_PASSWORD = process.env.TEST_RECEPTION_PASSWORD || 'Recept@2025!';

async function loginAs(app, email, password) {
  const request = require('supertest');
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed for ${email} (${res.statusCode}): ${JSON.stringify(res.body)}`);
  }
  return res.body.accessToken;
}

module.exports = {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_DENTIST_EMAIL,
  TEST_DENTIST_PASSWORD,
  TEST_RECEPTION_EMAIL,
  TEST_RECEPTION_PASSWORD,
  loginAs,
};
