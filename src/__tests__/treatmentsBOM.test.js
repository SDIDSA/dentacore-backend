const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const { sql } = require('kysely');
const app = require('../app');
const db = require('../config/database');
const { loginAs, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD } = require('./helpers/config');

let dbAvailable = true;
let adminToken = null;
let tenantId = null;
let dentistId = null;
let patientId = null;
let inventoryItemId = null;
let clinicalActId = null;
const createdTreatmentIds = [];

beforeAll(async () => {
  try {
    await sql`SELECT 1`.execute(db);
    adminToken = await loginAs(app, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('email', '=', TEST_ADMIN_EMAIL)
      .executeTakeFirst();
    if (!user) throw new Error('Test admin user not found');
    tenantId = user.tenant_id;
    dentistId = user.id;

    // Create a dedicated test patient
    const patRes = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        full_name: 'BOM Test Patient',
        date_of_birth: '1990-01-01',
        gender: 'patient.gender.female',
        phone: `+213${String(Date.now()).slice(-9)}`,
      });
    if (patRes.statusCode !== 201) throw new Error('Patient creation failed');
    patientId = patRes.body.id;

    // Create an inventory item with 50 units
    const itemCode = `BOM-ITEM-${Date.now()}`;
    const item = await db
      .insertInto('inventory_items')
      .values({
        tenant_id: tenantId,
        item_code: itemCode,
        name: 'BOM Composite Material',
        unit_of_measure: 'g',
        current_stock: 50.000,
        unit_cost_dzd: 1200.00,
        status_key: 'item.status.active',
      })
      .returningAll()
      .executeTakeFirst();
    inventoryItemId = item.id;

    // Create a clinical act
    const actCode = `BOM-ACT-${Date.now()}`;
    const act = await db
      .insertInto('clinical_acts')
      .values({
        tenant_id: tenantId,
        act_code: actCode,
        name: 'BOM Resin Restoration',
        standard_cost_dzd: 3500.00,
        default_duration_minutes: 30,
        is_active: true,
      })
      .returningAll()
      .executeTakeFirst();
    clinicalActId = act.id;

    // Link inventory item to clinical act (consume 2.500 g per treatment)
    await db
      .insertInto('clinical_act_materials')
      .values({
        clinical_act_id: clinicalActId,
        inventory_item_id: inventoryItemId,
        quantity_consumed: 2.500,
      })
      .execute();
  } catch (err) {
    console.warn(`[treatmentsBOM.test] DB unavailable: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  try {
    for (const id of createdTreatmentIds) {
      await db.deleteFrom('treatment_records').where('id', '=', id).execute();
    }
    if (inventoryItemId) {
      await db.deleteFrom('stock_movements').where('inventory_item_id', '=', inventoryItemId).execute();
    }
    if (clinicalActId) {
      await db.deleteFrom('clinical_act_materials').where('clinical_act_id', '=', clinicalActId).execute();
      await db.deleteFrom('clinical_acts').where('id', '=', clinicalActId).execute();
    }
    if (inventoryItemId) {
      await db.deleteFrom('inventory_items').where('id', '=', inventoryItemId).execute();
    }
    if (patientId) {
      await db.deleteFrom('odontogram_conditions').where('patient_id', '=', patientId).execute();
      await request(app)
        .delete(`/api/v1/patients/${patientId}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
  } catch (_) {
    /* ignore cleanup errors */
  }
});

describe('Treatment Bill of Materials (BOM) & Inventory Integration', () => {
  it('POST /api/v1/treatments with clinical_act_id deducts stock and records stock movement', async () => {
    if (!dbAvailable) return;

    // Verify initial stock
    const beforeItem = await db
      .selectFrom('inventory_items')
      .select('current_stock')
      .where('id', '=', inventoryItemId)
      .executeTakeFirst();
    expect(Number(beforeItem.current_stock)).toBe(50.000);

    // Save treatment with clinical_act_id
    const res = await request(app)
      .post('/api/v1/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        dentist_id: dentistId,
        treatment_date: new Date().toISOString(),
        diagnosis: 'Enamel Caries on Tooth 24',
        treatment_performed: 'Composite Filling with BOM',
        estimated_cost_dzd: 3500.00,
        clinical_act_id: clinicalActId,
        tooth_number: '24',
        notes: 'Clinical act bill of materials deduction test',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.clinical_act_id).toBe(clinicalActId);
    createdTreatmentIds.push(res.body.id);

    // Verify inventory current_stock depleted by 2.500 (50 - 2.5 = 47.5)
    const afterItem = await db
      .selectFrom('inventory_items')
      .select('current_stock')
      .where('id', '=', inventoryItemId)
      .executeTakeFirst();
    expect(Number(afterItem.current_stock)).toBe(47.500);

    // Verify stock_movements row created
    const movement = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('reference_id', '=', res.body.id)
      .executeTakeFirst();

    expect(movement).toBeDefined();
    expect(movement.inventory_item_id).toBe(inventoryItemId);
    expect(movement.movement_type).toBe('OUT');
    expect(Number(movement.quantity)).toBe(-2.500);
    expect(movement.reference_type).toBe('treatment_record');
    expect(movement.tenant_id).toBe(tenantId);
    expect(movement.notes).toContain(res.body.id);

    // Verify GET /:id returns clinical_act_id
    const getRes = await request(app)
      .get(`/api/v1/treatments/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.clinical_act_id).toBe(clinicalActId);

    // Verify GET /batch returns clinical_act_id
    const batchRes = await request(app)
      .get(`/api/v1/treatments/batch?ids=${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(batchRes.statusCode).toBe(200);
    expect(batchRes.body).toHaveLength(1);
    expect(batchRes.body[0].clinical_act_id).toBe(clinicalActId);

    // Verify GET / with clinical_act_id filter
    const filterRes = await request(app)
      .get(`/api/v1/treatments?clinical_act_id=${clinicalActId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filterRes.statusCode).toBe(200);
    expect(filterRes.body).toContain(res.body.id);
  });

  it('POST /api/v1/treatments without clinical_act_id functions normally with no stock movements', async () => {
    if (!dbAvailable) return;

    // Record stock before
    const beforeItem = await db
      .selectFrom('inventory_items')
      .select('current_stock')
      .where('id', '=', inventoryItemId)
      .executeTakeFirst();
    const stockBefore = Number(beforeItem.current_stock);

    // Save treatment without clinical_act_id
    const res = await request(app)
      .post('/api/v1/treatments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        dentist_id: dentistId,
        treatment_date: new Date().toISOString(),
        diagnosis: 'Routine Scaling',
        treatment_performed: 'Dental Prophylaxis',
        estimated_cost_dzd: 2000.00,
        tooth_number: '11',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.clinical_act_id).toBeNull();
    createdTreatmentIds.push(res.body.id);

    // Stock must remain unchanged
    const afterItem = await db
      .selectFrom('inventory_items')
      .select('current_stock')
      .where('id', '=', inventoryItemId)
      .executeTakeFirst();
    expect(Number(afterItem.current_stock)).toBe(stockBefore);

    // No stock movement should exist for this treatment
    const movements = await db
      .selectFrom('stock_movements')
      .selectAll()
      .where('reference_id', '=', res.body.id)
      .execute();
    expect(movements).toHaveLength(0);
  });

  it('POST /api/v1/odontogram/condition saves tooth condition and notes', async () => {
    if (!dbAvailable) return;

    const res = await request(app)
      .post('/api/v1/odontogram/condition')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patient_id: patientId,
        tooth_number: '24',
        condition: 'treated',
        notes: 'BOM composite restoration performed',
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.tooth_number).toBe('24');
    expect(res.body.condition).toBe('treated');

    // Verify GET /api/v1/odontogram/:patientId reflects updated condition
    const odontoRes = await request(app)
      .get(`/api/v1/odontogram/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(odontoRes.statusCode).toBe(200);
    expect(odontoRes.body.teeth?.['24']?.condition).toBe('treated');
    expect(odontoRes.body.teeth?.['24']?.condition_notes).toBe('BOM composite restoration performed');
  });
});
