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

const INVOICE_TOTAL = 5000;

async function createPatient() {
  const res = await request(app)
    .post('/api/v1/patients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      full_name: 'Reconcile Test Patient',
      date_of_birth: '1993-04-04',
      gender: 'patient.gender.male',
      phone: `+213${String(Date.now()).slice(-9)}`,
    });
  if (res.statusCode !== 201) throw new Error(`Patient creation failed: ${res.statusCode}`);
  return res.body.id;
}

async function getInvoice(id) {
  const res = await request(app)
    .get(`/api/v1/invoices/${id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.statusCode).toBe(200);
  return res.body;
}

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });
    if (login.statusCode !== 200) throw new Error('Admin login failed');
    adminToken = login.body.accessToken;

    patientId = await createPatient();

    const invRes = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        issue_date: new Date().toISOString(),
        line_items: [{ description: 'Reconciliation test item', quantity: 1, unit_price_dzd: INVOICE_TOTAL }],
      });
    if (invRes.statusCode !== 201) throw new Error(`Invoice creation failed: ${invRes.statusCode}`);
    invoiceId = invRes.body.id;
  } catch (err) {
    console.warn(`[invoicePaymentReconciliation] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    if (invoiceId) {
      await request(app)
        .delete(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    if (patientId) {
      await request(app)
        .delete(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Payment <-> invoice reconciliation', () => {
  it('adding a payment recomputes paid_amount_dzd and payment_status_key', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        invoice_id: invoiceId,
        amount_dzd: 2000,
        payment_method_key: 'pay.method.cash',
        payment_date: new Date().toISOString(),
        notes: 'reconciliation regression payment',
      });
    expect(res.statusCode).toBe(201);
    paymentId = res.body.id;

    const invoice = await getInvoice(invoiceId);
    expect(Number(invoice.paid_amount_dzd)).toBe(2000);
    expect(invoice.payment_status_key).toBe('invoice.status.partial');
  });

  it('PATCHing a payment beyond the remaining balance is rejected with 400', async () => {
    if (!dbAvailable || !paymentId) return;
    const res = await request(app)
      .patch(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount_dzd: INVOICE_TOTAL + 5000 });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('deleting the payment recomputes the invoice back to unpaid / 0 paid', async () => {
    if (!dbAvailable || !paymentId) return;
    const del = await request(app)
      .delete(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(del.statusCode).toBe(204);
    const consumed = paymentId;
    paymentId = null;

    const invoice = await getInvoice(invoiceId);
    expect(Number(invoice.paid_amount_dzd)).toBe(0);
    expect(invoice.payment_status_key).toBe('invoice.status.unpaid');
    expect(invoice.payments.find((p) => p.id === consumed)).toBeUndefined();
  });

  it('PATCH invoice status with a garbage payment_status_key is rejected with 400', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .patch(`/api/v1/invoices/${invoiceId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ payment_status_key: 'garbage.status.key' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);

    // whitelist must not have been applied
    const invoice = await getInvoice(invoiceId);
    expect(invoice.payment_status_key).toBe('invoice.status.unpaid');
  });
});
