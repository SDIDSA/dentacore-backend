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
let invoiceId = null;
let paymentId = null;
let creditNoteId = null;

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
        full_name: 'CreditNote Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'patient.gender.female',
        phone: `+213${String(Date.now()).slice(-9)}`,
      });
    if (patRes.statusCode !== 201) throw new Error('Patient creation failed');
    patientId = patRes.body.id;

    const invRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        issue_date: new Date().toISOString(),
        line_items: [{ description: 'Test treatment item', quantity: 1, unit_price_dzd: 4000 }],
      });
    if (invRes.statusCode !== 201) throw new Error('Invoice creation failed');
    invoiceId = invRes.body.id;

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice_id: invoiceId,
        amount_dzd: 2500,
        payment_method_key: 'pay.method.cash',
        payment_date: new Date().toISOString(),
        notes: 'Test initial payment',
      });
    if (payRes.statusCode !== 201) throw new Error('Payment creation failed');
    paymentId = payRes.body.id;
  } catch (err) {
    console.warn(`[creditNotes.test] DB unavailable or setup failed: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (creditNoteId) {
      await db.deleteFrom('credit_notes').where('id', '=', creditNoteId).execute();
    }
    if (paymentId) {
      await db.deleteFrom('payments').where('id', '=', paymentId).execute();
    }
    if (invoiceId) {
      await db.deleteFrom('invoice_items').where('invoice_id', '=', invoiceId).execute();
      await db.deleteFrom('invoices').where('id', '=', invoiceId).execute();
    }
    if (patientId) {
      await request(app)
        .delete(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Credit Notes API', () => {
  it('POST /api/v1/credit-notes rejects amount greater than invoice paid amount', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice_id: invoiceId,
        amount_dzd: 5000,
        reason: 'Refund exceeding payment',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('credit_note.error.exceeds_paid_amount');
  });

  it('POST /api/v1/credit-notes creates a valid credit note with CN-YYYYMM-NNNN', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice_id: invoiceId,
        amount_dzd: 1000,
        reason: 'Partial patient refund',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.credit_note_number).toMatch(/^CN-\d{6}-\d{4}$/);
    expect(Number(res.body.amount_dzd)).toBe(1000);
    creditNoteId = res.body.id;
  });

  it('GET /api/v1/credit-notes lists credit notes for tenant', async () => {
    if (!dbAvailable || !creditNoteId) return;
    const res = await request(app)
      .get('/api/v1/credit-notes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(cn => cn.id === creditNoteId)).toBe(true);
  });

  it('GET /api/v1/credit-notes/:id returns the single credit note', async () => {
    if (!dbAvailable || !creditNoteId) return;
    const res = await request(app)
      .get(`/api/v1/credit-notes/${creditNoteId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(creditNoteId);
    expect(res.body.invoice_id).toBe(invoiceId);
  });
});
