const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const app = require('../app');
const { TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

function uuidv4() { return crypto.randomUUID(); }

// Track IDs created during tests so we can clean up
const createdIds = {
  patients: [],
  inventoryItems: [],
};

let authToken = null;
let refreshToken = null;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

  if (res.statusCode !== 200) {
    throw new Error(
      `Login failed (${res.statusCode}): ${JSON.stringify(res.body)}`
    );
  }

  authToken = res.body.accessToken;
  refreshToken = res.body.refreshToken;

  if (!authToken) throw new Error('No accessToken in login response');
});

afterAll(async () => {
  // Clean up created inventory items
  for (const id of createdIds.inventoryItems) {
    try {
      await request(app)
        .delete(`/api/v1/inventory/items/${id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore cleanup errors */ }
  }

  // Clean up created patients (reverse order for FK constraints)
  for (const id of createdIds.patients) {
    try {
      await request(app)
        .delete(`/api/v1/patients/${id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore cleanup errors */ }
  }
});

// ────────────────────────────────────────────────────────────────────
// Health & Info
// ────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/version', () => {
  it('should return version info', async () => {
    const res = await request(app).get('/api/version');
    expect(res.statusCode).toBe(200);
    expect(res.body.version).toBe('v1');
    expect(res.body.current).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  it('should login with valid credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.id).toBeDefined();
    expect(res.body.fullName).toBeDefined();
    expect(res.body.roleKey).toBe('auth.role.admin');
    expect(res.body.tenantId).toBeDefined();
  });

  it('should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN_EMAIL, password: 'wrongpassword' });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid_credentials/i);
  });

  it('should reject non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@test.dz', password: 'SomePass123!' });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toMatch(/invalid_credentials/i);
  });

  it('should return validation error for missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('should return validation error for invalid email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'notanemail', password: 'SomePass123!' });

    expect([400, 429]).toContain(res.statusCode);
    if (res.statusCode === 400) {
      expect(res.body.error).toMatch(/validation/i);
    }
  });
});

describe('GET /api/v1/auth/validate', () => {
  it('should validate a valid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/validate')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBeDefined();
    expect(res.body.fullName).toBeDefined();
    expect(res.body.roleKey).toBe('auth.role.admin');
  });

  it('should reject missing token', async () => {
    const res = await request(app).get('/api/v1/auth/validate');

    expect(res.statusCode).toBe(401);
  });

  it('should reject invalid token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/validate')
      .set('Authorization', 'Bearer invalidtoken123');

    expect(res.statusCode).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────
// Patients
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/patients', () => {
  it('should return list of patient IDs', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(typeof res.body[0]).toBe('string');
    }
  });

  it('should support search by name', async () => {
    const res = await request(app)
      .get('/api/v1/patients?search=Ahmed')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/v1/patients/:id', () => {
  it('should return 404 for non-existent patient', async () => {
    const res = await request(app)
      .get('/api/v1/patients/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('should return patient details for valid ID', async () => {
    // First list patients to get a valid ID
    const list = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`);

    if (list.body.length === 0) return; // skip if no patients

    const patientId = list.body[0];
    const res = await request(app)
      .get(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(patientId);
    expect(res.body.full_name).toBeDefined();
    expect(res.body.patient_code).toBeDefined();
  });
});

describe('POST /api/v1/patients', () => {
  const NEW_PATIENT = {
    full_name: 'Test Patient API',
    date_of_birth: '1990-05-15',
    gender: 'patient.gender.male',
    phone: '+213661234567',
    email: 'testpatientapi@test.dz',
    blood_type: 'A+',
  };

  it('should create a new patient', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send(NEW_PATIENT);

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.full_name).toBe(NEW_PATIENT.full_name);
    expect(res.body.patient_code).toMatch(/^PAT-\d{4}-\d{4}$/);
    expect(res.body.blood_type).toBe('A+');

    createdIds.patients.push(res.body.id);
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('should reject invalid phone format', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...NEW_PATIENT, phone: 'invalid-phone' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('should reject invalid gender', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...NEW_PATIENT, gender: 'invalid.gender' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

describe('PATCH /api/v1/patients/:id', () => {
  it('should update patient name', async () => {
    // Need a patient to update - create one
    const create = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        full_name: 'Update Test Patient',
        date_of_birth: '1985-03-20',
        gender: 'patient.gender.female',
        phone: '+213771234567',
      });

    expect(create.statusCode).toBe(201);
    const patientId = create.body.id;
    createdIds.patients.push(patientId);

    const res = await request(app)
      .patch(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ full_name: 'Updated Name' });

    expect(res.statusCode).toBe(200);
    expect(res.body.full_name).toBe('Updated Name');
  });
});

describe('PATCH /api/v1/patients/:id/status', () => {
  it('should update patient status', async () => {
    const statusPhone = `+213${String(Date.now()).slice(-9)}`;
    const create = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        full_name: 'Status Test Patient',
        date_of_birth: '1992-07-10',
        gender: 'patient.gender.male',
        phone: statusPhone,
      });

    expect(create.statusCode).toBe(201);
    const patientId = create.body.id;
    createdIds.patients.push(patientId);

    const res = await request(app)
      .patch(`/api/v1/patients/${patientId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status_key: 'patient.status.inactive' });

    expect(res.statusCode).toBe(200);
    expect(res.body.status_key).toBe('patient.status.inactive');
  });
});

describe('DELETE /api/v1/patients/:id', () => {
  it('should delete a newly created patient (no invoices)', async () => {
    const create = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        full_name: 'Delete Test Patient',
        date_of_birth: '2000-01-01',
        gender: 'patient.gender.female',
        phone: '+213661111111',
      });

    expect(create.statusCode).toBe(201);
    const patientId = create.body.id;

    const res = await request(app)
      .delete(`/api/v1/patients/${patientId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(204);
    // Don't add to createdIds since we just deleted it
  });
});

// ────────────────────────────────────────────────────────────────────
// Appointments
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/appointments', () => {
  it('should return list of appointments', async () => {
    const res = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────
// Invoices
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/invoices', () => {
  it('should return list of invoice IDs', async () => {
    const res = await request(app)
      .get('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(typeof res.body[0]).toBe('string');
    }
  });
});

// No dedicated invoices/stats endpoint — stats are under /api/v1/dashboard/

// ────────────────────────────────────────────────────────────────────
// Treatments
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/treatments', () => {
  it('should return list of treatments', async () => {
    const res = await request(app)
      .get('/api/v1/treatments')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/v1/treatments', () => {
  it('should create a treatment with patient_id and dentist_id', async () => {
    // Need existing patient and dentist (DB columns are NOT NULL)
    const [patRes, userRes] = await Promise.all([
      request(app).get('/api/v1/patients').set('Authorization', `Bearer ${authToken}`),
      request(app).get('/api/v1/users').set('Authorization', `Bearer ${authToken}`),
    ]);
    expect(patRes.statusCode).toBe(200);
    expect(patRes.body.length).toBeGreaterThan(0);
    expect(userRes.statusCode).toBe(200);
    expect(userRes.body.length).toBeGreaterThan(0);
    const patientId = patRes.body[0];
    const dentistId = userRes.body[0];

    const res = await request(app)
      .post('/api/v1/treatments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        patient_id: patientId,
        dentist_id: dentistId,
        treatment_date: new Date().toISOString(),
        diagnosis: 'Test diagnosis',
        treatment_performed: 'Test procedure',
        estimated_cost_dzd: 5000.0,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.diagnosis).toBe('Test diagnosis');

    // Cleanup
    try {
      await request(app)
        .delete(`/api/v1/treatments/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore */ }
  });
});

// ────────────────────────────────────────────────────────────────────
// Inventory
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/inventory/categories', () => {
  it('should return list of inventory categories', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const batch = await request(app)
        .get(`/api/v1/inventory/categories/batch?ids=${res.body[0]}`)
        .set('Authorization', `Bearer ${authToken}`);
      if (batch.body.length > 0) {
        expect(batch.body[0]).toHaveProperty('category_key');
      }
    }
  });
});

describe('GET /api/v1/inventory/items', () => {
  it('should return list of inventory item IDs', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/v1/inventory/items', () => {
  it('should create a new inventory item', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Inventory Item API',
        unit_of_measure: 'piece',
        unit_cost_dzd: 1500.0,
        min_stock_level: 5,
        current_stock: 20,
        selling_price_dzd: 2500.0,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Inventory Item API');
    expect(res.body.item_code).toMatch(/^ITM-\d{4}-\d{4}$/);

    createdIds.inventoryItems.push(res.body.id);
  });

  it('should reject missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Incomplete Item' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it('should reject negative unit cost', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Negative Cost Item',
        unit_of_measure: 'piece',
        unit_cost_dzd: -100,
        min_stock_level: 5,
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

describe('GET /api/v1/inventory/items/:id', () => {
  it('should return 404 for non-existent item', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/items/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('should return item details for a valid item', async () => {
    // Create one first
    const create = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Detail Test Item',
        unit_of_measure: 'box',
        unit_cost_dzd: 3000.0,
        min_stock_level: 2,
        current_stock: 10,
      });

    expect(create.statusCode).toBe(201);
    const itemId = create.body.id;
    createdIds.inventoryItems.push(itemId);

    const res = await request(app)
      .get(`/api/v1/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(itemId);
    expect(res.body.name).toBe('Detail Test Item');
    expect(res.body.total_value_dzd).toBeDefined();
  });
});

describe('PATCH /api/v1/inventory/items/:id', () => {
  it('should update inventory item fields', async () => {
    const create = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Patch Test Item',
        unit_of_measure: 'piece',
        unit_cost_dzd: 100.0,
        min_stock_level: 3,
        current_stock: 10,
      });

    expect(create.statusCode).toBe(201);
    const itemId = create.body.id;
    createdIds.inventoryItems.push(itemId);

    const res = await request(app)
      .patch(`/api/v1/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Updated Patch Item', unit_cost_dzd: 120.0 });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Updated Patch Item');
    expect(parseFloat(res.body.unit_cost_dzd)).toBe(120.0);
  });
});

describe('DELETE /api/v1/inventory/items/:id', () => {
  it('should return 404 for non-existent item', async () => {
    const res = await request(app)
      .delete(`/api/v1/inventory/items/${uuidv4()}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(404);
  });

  it('should delete an existing inventory item', async () => {
    const delCode = `DEL-${String(Date.now()).slice(-6)}`;
    const create = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Delete Test Item',
        unit_of_measure: 'unit',
        item_code: delCode,
        current_stock: 5,
        min_stock_level: 2,
        unit_cost_dzd: 25.0,
        selling_price_dzd: 50.0,
      });

    expect(create.statusCode).toBe(201);
    const itemId = create.body.id;

    const res = await request(app)
      .delete(`/api/v1/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(204);
  });
});

describe('POST /api/v1/expenses', () => {
  it('should create a new expense', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        category_key: 'expense.category.supplies',
        description: 'Test expense',
        amount_dzd: 5000.0,
        expense_date: new Date().toISOString(),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.expense_number).toMatch(/^EXP-\d{6}-\d{4}$/);

    // Cleanup
    try {
      await request(app)
        .delete(`/api/v1/expenses/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore */ }
  });
});

describe('POST /api/v1/appointments', () => {
  it('should reject appointment with missing required fields', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({});

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });
});

describe('POST /api/v1/invoices', () => {
  it('should create an invoice with patient_id', async () => {
    const patRes = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`);
    expect(patRes.body.length).toBeGreaterThan(0);
    const patientId = patRes.body[0];

    const res = await request(app)
      .post('/api/v1/invoices')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        patient_id: patientId,
        issue_date: new Date().toISOString(),
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        line_items: [
          { description: 'Consultation', quantity: 1, unit_price_dzd: 5000 },
          { description: 'X-Ray', quantity: 1, unit_price_dzd: 2000 },
        ],
        notes: 'Test invoice',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.invoice_number).toMatch(/^INV-\d{6}-\d{4}$/);

    // Cleanup
    try {
      await request(app)
        .delete(`/api/v1/invoices/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore */ }
  });
});

describe('POST /api/v1/inventory/items/:id/adjust-stock', () => {
  it('should adjust stock quantity', async () => {
    const create = await request(app)
      .post('/api/v1/inventory/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Stock Adjust Item',
        unit_of_measure: 'piece',
        unit_cost_dzd: 500.0,
        min_stock_level: 5,
        current_stock: 10,
      });

    expect(create.statusCode).toBe(201);
    const itemId = create.body.id;
    createdIds.inventoryItems.push(itemId);

    const res = await request(app)
      .post(`/api/v1/inventory/items/${itemId}/adjust-stock`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ quantity: 5, reason: 'Test stock adjustment' });

    expect(res.statusCode).toBe(200);
    expect(parseFloat(res.body.current_stock)).toBe(15);
  });
});

// ────────────────────────────────────────────────────────────────────
// Suppliers
// ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/inventory/suppliers', () => {
  it('should return list of suppliers', async () => {
    const res = await request(app)
      .get('/api/v1/inventory/suppliers')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/v1/inventory/suppliers', () => {
  it('should create a new supplier', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/suppliers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Supplier API',
        contact_person: 'John Doe',
        email: 'supplierapi@test.dz',
        phone: '+213771111111',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Supplier API');
    expect(res.body.supplier_code).toMatch(/^SUP-\d{4}-\d{4}$/);

    // Cleanup
    try {
      await request(app)
        .delete(`/api/v1/inventory/suppliers/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    } catch (_) { /* ignore */ }
  });
});

// ────────────────────────────────────────────────────────────────────
// X-Rays
// ────────────────────────────────────────────────────────────────────

describe('DELETE /api/v1/xrays/:id', () => {
  it('should upload and then delete an xray', async () => {
    const patRes = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${authToken}`);
    expect(patRes.statusCode).toBe(200);
    expect(patRes.body.length).toBeGreaterThan(0);
    const patientId = patRes.body[0];

    const fakeImage = Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA=', 'base64'
    );

    const upload = await request(app)
      .post('/api/v1/xrays/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', fakeImage, 'test.jpg')
      .field('patient_id', patientId)
      .field('description', 'Test xray for delete');

    expect(upload.statusCode).toBe(201);
    expect(upload.body.id).toBeDefined();
    const xrayId = upload.body.id;

    const del = await request(app)
      .delete(`/api/v1/xrays/${xrayId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(del.statusCode).toBe(204);
  });
});

// ────────────────────────────────────────────────────────────────────
// Protected Endpoints (no auth)
// ────────────────────────────────────────────────────────────────────

describe('Protected endpoints without auth token', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/v1/patients' },
    { method: 'get', path: '/api/v1/appointments' },
    { method: 'get', path: '/api/v1/invoices' },
    { method: 'get', path: '/api/v1/treatments' },
    { method: 'get', path: '/api/v1/inventory/items' },
    { method: 'get', path: '/api/v1/inventory/categories' },
    { method: 'get', path: '/api/v1/inventory/suppliers' },
    { method: 'get', path: '/api/v1/users' },
    { method: 'get', path: '/api/v1/audit-logs' },
  ];

  protectedRoutes.forEach(({ method, path }) => {
    it(`should return 401 for ${method.toUpperCase()} ${path} without auth`, async () => {
      const res = await request(app)[method](path);
      expect(res.statusCode).toBe(401);
    });
  });
});
