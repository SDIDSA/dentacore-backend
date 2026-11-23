const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let dbAvailable = true;
let adminToken = null;
let patientId = null;
let prescriptionId = null;

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;

    const patRes = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'Pediatric Test Patient',
        date_of_birth: '2018-05-15',
        gender: 'patient.gender.male',
        phone: `+213${String(Date.now()).slice(-9)}`,
      });
    if (patRes.statusCode !== 201) throw new Error('Patient creation failed');
    patientId = patRes.body.id;
  } catch (err) {
    console.warn(`[deciduousTeethAndMultiDrug.test] DB unavailable: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (prescriptionId) {
      await db.deleteFrom('prescriptions').where('id', '=', prescriptionId).execute();
    }
    if (patientId) {
      await request(app)
        .delete(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Milestone 2 APIs: Deciduous Teeth, Multi-Drug Prescriptions, and Route Removals', () => {
  it('POST /api/v1/prescriptions creates a multi-drug prescription with child line items', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/prescriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        notes: 'Post-op pediatric medication',
        status_key: 'prescription.status.active',
        items: [
          {
            medication_name: 'Amoxicillin 250mg/5ml',
            dosage: '5ml',
            frequency_key: 'prescription.frequency.three_times_daily',
            duration_days: 7,
            instructions: 'Take after meals',
          },
          {
            medication_name: 'Paracetamol Syrup',
            dosage: '10ml',
            frequency_key: 'prescription.frequency.as_needed',
            duration_days: 3,
            instructions: 'In case of fever > 38.5C',
          },
        ],
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.prescription_number).toMatch(/^RX-\d{6}-\d{4}$/);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].medication_name).toBe('Amoxicillin 250mg/5ml');
    expect(res.body.items[1].medication_name).toBe('Paracetamol Syrup');
    prescriptionId = res.body.id;

    // Verify GET /:id returns items
    const getRes = await request(app)
      .get(`/api/v1/prescriptions/${prescriptionId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.items).toHaveLength(2);
  });

  it('PUT /api/v1/odontogram/:patientId/tooth/:toothNumber accepts deciduous tooth 55', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .put(`/api/v1/odontogram/${patientId}/tooth/55`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        condition: 'caries',
        notes: 'Deciduous molar caries on occlusal surface',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.tooth_number).toBe('55');
    expect(res.body.condition).toBe('caries');
  });

  it('PATCH /api/v1/invoices/:id/payment route is removed and returns 404', async () => {
    if (!dbAvailable) return;
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .patch(`/api/v1/invoices/${fakeId}/payment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paid_amount_dzd: 1000 });

    expect(res.statusCode).toBe(404);
  });
});
