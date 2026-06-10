const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);

// Get all patients
router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query;
    const pag = parsePagination(req);

    let query = db
      .selectFrom('patients')
      .select(['patients.id'])
      .where('patients.tenant_id', '=', req.tenantId)

    let countQuery = db
      .selectFrom('patients')
      .select(sql`COUNT(*)`.as('count'))
      .where('patients.tenant_id', '=', req.tenantId)

    if (search) {
      const searchFilter = (eb) =>
        eb.or([
          eb(sql`to_tsvector('simple', patients.full_name)`, '@@', sql`to_tsquery('simple', ${search})`),
          eb('patients.patient_code', 'ilike', `%${search}%`)
        ]);
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    const patients = await query
      .orderBy('patients.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const patientIds = patients.map(p => p.id);
    if (pag.paginate) {
      const countResult = await countQuery.executeTakeFirst();
      res.json(wrapPaginatedResponse(patientIds, parseInt(countResult.count), pag.limit, pag.offset));
    } else {
      res.json(patientIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get patient by ID
router.get('/:id', async (req, res, next) => {
  try {
    let patient = await db
      .selectFrom('patients')
      .leftJoin('wilayas', 'patients.wilaya_id', 'wilayas.id')
      .select([
        'patients.id',
        'patients.patient_code',
        'patients.full_name',
        'patients.date_of_birth',
        'patients.gender',
        'patients.phone',
        'patients.email',
        'patients.wilaya_id',
        'patients.address',
        'patients.emergency_contact_name',
        'patients.emergency_contact_phone',
        'patients.medical_history',
        'patients.allergies',
        'patients.blood_type',
        'patients.status_key',
        'patients.created_at',
        'wilayas.name_key as wilaya_name_key',
        // Subquery for last visit date (most recent completed appointment)
        (eb) => eb
          .selectFrom('appointments')
          .select('appointments.appointment_date')
          .whereRef('appointments.patient_id', '=', 'patients.id')
          .whereRef('appointments.tenant_id', '=', 'patients.tenant_id')
          .where('appointments.appointment_date', '<', sql`NOW()`)
          .where('appointments.status_key', '=', 'appt.status.completed')
          .orderBy('appointments.appointment_date', 'desc')
          .limit(1)
          .as('last_visit_date'),
        // Subquery for next appointment date (next scheduled/confirmed appointment)
        (eb) => eb
          .selectFrom('appointments')
          .select('appointments.appointment_date')
          .whereRef('appointments.patient_id', '=', 'patients.id')
          .whereRef('appointments.tenant_id', '=', 'patients.tenant_id')
          .where('appointments.status_key', 'in', ['appt.status.scheduled', 'appt.status.confirmed'])
          .where('appointments.appointment_date', '>', sql`NOW()`)
          .orderBy('appointments.appointment_date', 'asc')
          .limit(1)
          .as('next_appointment_date')
      ])
      .where('patients.id', '=', req.params.id)
      .where('patients.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!patient) {
      patient = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'patients')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst())?.old_values;

      if (!patient) {
        return res.status(404).json({ error: 'patient.error.not_found' });
      }
    }

    res.json(patient);
  } catch (error) {
    next(error);
  }
});

// Create patient
router.post('/',
  body('full_name').trim().notEmpty(),
  body('date_of_birth').isDate(),
  body('gender').isIn(['patient.gender.male', 'patient.gender.female']),
  body('phone').matches(/^\+213[0-9]{9}$/),
  body('blood_type').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        full_name, date_of_birth, gender, phone, email,
        wilaya_id, address, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, blood_type
      } = req.body;

      // Generate patient code in a transaction to prevent duplicates
      const patient = await db.transaction().execute(async (trx) => {
        await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.execute(trx);

        const year = new Date().getFullYear();
        const highestCodeResult = await trx
          .selectFrom('patients')
          .select('patient_code')
          .where('patient_code', 'like', `PAT-${year}-%`)
          .where('tenant_id', '=', req.tenantId)
          .orderBy('patient_code', 'desc')
          .limit(1)
          .executeTakeFirst();

        let nextNum = 1;
        if (highestCodeResult) {
          const match = highestCodeResult.patient_code.match(/PAT-\d{4}-(\d{4})$/);
          if (match) {
            nextNum = parseInt(match[1]) + 1;
          }
        }

        const patient_code = `PAT-${year}-${String(nextNum).padStart(4, '0')}`;
        return await trx
          .insertInto('patients')
          .values({
            tenant_id: req.tenantId,
            patient_code,
            full_name,
            date_of_birth,
            gender,
            phone,
            email: email || null,
            wilaya_id: wilaya_id || null,
            address: address || null,
            emergency_contact_name: emergency_contact_name || null,
            emergency_contact_phone: emergency_contact_phone || null,
            medical_history: medical_history || null,
            allergies: allergies || null,
            blood_type: blood_type || null,
            created_by: req.user.id
          })
          .returningAll()
          .executeTakeFirst();
      });

      // Log the patient creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'patients',
          entityId: patient.id,
          tenantId: req.tenantId,
          newValues: patient
        });
      }

      res.status(201).json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Update patient
router.patch('/:id',
  body('full_name').optional().trim().notEmpty(),
  body('date_of_birth').optional().isDate(),
  body('gender').optional().isIn(['patient.gender.male', 'patient.gender.female']),
  body('phone').optional().matches(/^\+213[0-9]{9}$/),
  body('status_key').optional().isIn([
    'patient.status.active',
    'patient.status.new',
    'patient.status.inactive',
    'patient.status.archived',
    'patient.status.blocked'
  ]),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        full_name, date_of_birth, gender, phone, email,
        wilaya_id, address, emergency_contact_name, emergency_contact_phone,
        medical_history, allergies, blood_type, status_key
      } = req.body;

      // Get current state for audit logging
      const currentPatient = await db
        .selectFrom('patients')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentPatient) {
        return res.status(404).json({ error: 'patient.error.not_found' });
      }

      const updateData = {};
      if (full_name !== undefined) updateData.full_name = full_name;
      if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
      if (gender !== undefined) updateData.gender = gender;
      if (phone !== undefined) updateData.phone = phone;
      if (email !== undefined) updateData.email = email;
      if (wilaya_id !== undefined) updateData.wilaya_id = wilaya_id;
      if (address !== undefined) updateData.address = address;
      if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name;
      if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone;
      if (medical_history !== undefined) updateData.medical_history = medical_history;
      if (allergies !== undefined) updateData.allergies = allergies;
      if (blood_type !== undefined) updateData.blood_type = blood_type;
      if (status_key !== undefined) updateData.status_key = status_key;
      updateData.updated_at = new Date();

      const patient = await db
        .updateTable('patients')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'patients',
          entityId: patient.id,
          tenantId: req.tenantId,
          oldValues: currentPatient,
          newValues: patient
        });
      }

      res.json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Update patient status
router.patch('/:id/status',
  body('status_key').isIn([
    'patient.status.active',
    'patient.status.new',
    'patient.status.inactive',
    'patient.status.archived',
    'patient.status.blocked'
  ]),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { status_key } = req.body;

      // Get current state for audit logging
      const currentPatient = await db
        .selectFrom('patients')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentPatient) {
        return res.status(404).json({ error: 'patient.error.not_found' });
      }

      const patient = await db
        .updateTable('patients')
        .set({
          status_key,
          updated_at: new Date()
        })
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'patients',
          entityId: patient.id,
          tenantId: req.tenantId,
          oldValues: { status_key: currentPatient.status_key },
          newValues: { status_key: patient.status_key }
        });
      }

      res.json(patient);
    } catch (error) {
      next(error);
    }
  }
);

// Delete patient
router.delete('/:id', async (req, res, next) => {
  try {
    const patientId = req.params.id;

    const patient = await db
      .selectFrom('patients')
      .selectAll()
      .where('id', '=', patientId)
      .where('tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!patient) {
      return res.status(404).json({ error: 'patient.error.not_found' });
    }

    // Check for invoices before deleting (due to ON DELETE RESTRICT)
    const hasInvoices = await db
      .selectFrom('invoices')
      .select('id')
      .where('patient_id', '=', patientId)
      .where('tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (hasInvoices) {
      return res.status(400).json({ error: 'patient.error.has_invoices' });
    }

    await db
      .deleteFrom('patients')
      .where('id', '=', patientId)
      .where('tenant_id', '=', req.tenantId)
      .execute();

    // Log the deletion
    patient.status_key = 'patient.status.deleted';
    if (req.audit) {
      await req.audit.log({
        action: 'DELETE',
        entityType: 'patients',
        entityId: patientId,
        tenantId: req.tenantId,
        oldValues: patient
      });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

// Get patient detail with related records (appointments, treatments, invoices)
router.get('/:id/detail', async (req, res, next) => {
  try {
    const patientId = req.params.id;

    let patient = await db
      .selectFrom('patients')
      .leftJoin('wilayas', 'patients.wilaya_id', 'wilayas.id')
      .select([
        'patients.id',
        'patients.patient_code',
        'patients.full_name',
        'patients.date_of_birth',
        'patients.gender',
        'patients.phone',
        'patients.email',
        'patients.wilaya_id',
        'patients.address',
        'patients.emergency_contact_name',
        'patients.emergency_contact_phone',
        'patients.medical_history',
        'patients.allergies',
        'patients.blood_type',
        'patients.status_key',
        'patients.created_at',
        'wilayas.name_key as wilaya_name_key',
      ])
      .where('patients.id', '=', patientId)
      .where('patients.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!patient) {
      return res.status(404).json({ error: 'patient.error.not_found' });
    }

    const appointments = await db
      .selectFrom('appointments')
      .leftJoin('users', 'appointments.dentist_id', 'users.id')
      .select([
        'appointments.id',
        'appointments.appointment_date',
        'appointments.duration_minutes',
        'appointments.status_key',
        'appointments.reason',
        'appointments.notes',
        'users.full_name as dentist_name',
      ])
      .where('appointments.patient_id', '=', patientId)
      .where('appointments.tenant_id', '=', req.tenantId)
      .orderBy('appointments.appointment_date', 'desc')
      .limit(20)
      .execute();

    const treatments = await db
      .selectFrom('treatment_records')
      .leftJoin('users', 'treatment_records.dentist_id', 'users.id')
      .select([
        'treatment_records.id',
        'treatment_records.treatment_date',
        'treatment_records.tooth_number',
        'treatment_records.diagnosis',
        'treatment_records.treatment_performed',
        'treatment_records.notes',
        'treatment_records.estimated_cost_dzd',
        'users.full_name as dentist_name',
      ])
      .where('treatment_records.patient_id', '=', patientId)
      .where('treatment_records.tenant_id', '=', req.tenantId)
      .orderBy('treatment_records.treatment_date', 'desc')
      .limit(20)
      .execute();

    const invoices = await db
      .selectFrom('invoices')
      .select([
        'invoices.id',
        'invoices.invoice_number',
        'invoices.issue_date',
        'invoices.due_date',
        'invoices.subtotal_dzd',
        'invoices.discount_dzd',
        'invoices.tax_dzd',
        'invoices.total_dzd',
        'invoices.paid_amount_dzd',
        sql`invoices.total_dzd - invoices.paid_amount_dzd`.as('balance_dzd'),
        'invoices.payment_status_key',
        'invoices.notes',
      ])
      .where('invoices.patient_id', '=', patientId)
      .where('invoices.tenant_id', '=', req.tenantId)
      .orderBy('invoices.issue_date', 'desc')
      .limit(20)
      .execute();

    const invoiceIds = invoices.map(inv => inv.id);
    let payments = [];
    if (invoiceIds.length > 0) {
      payments = await db
        .selectFrom('payments')
        .leftJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
        .select([
          'payments.id',
          'payments.invoice_id',
          'payments.amount_dzd',
          'payments.payment_date',
          'payments.notes',
          'payment_methods.name_key as payment_method_key',
        ])
        .where('payments.invoice_id', 'in', invoiceIds)
        .where('payments.tenant_id', '=', req.tenantId)
        .orderBy('payments.payment_date', 'desc')
        .execute();
    }

    const paymentsByInvoice = {};
    for (const payment of payments) {
      if (!paymentsByInvoice[payment.invoice_id]) {
        paymentsByInvoice[payment.invoice_id] = [];
      }
      paymentsByInvoice[payment.invoice_id].push(payment);
    }

    const invoicesWithPayments = invoices.map(inv => ({
      ...inv,
      payments: paymentsByInvoice[inv.id] || [],
    }));

    const plans = await db
      .selectFrom('treatment_plans')
      .selectAll()
      .where('treatment_plans.patient_id', '=', patientId)
      .where('treatment_plans.tenant_id', '=', req.tenantId)
      .orderBy('treatment_plans.created_at', 'desc')
      .execute();

    const planIds = plans.map(p => p.id);
    let aggregates = [];
    if (planIds.length > 0) {
      aggregates = await db
        .selectFrom('treatment_records')
        .select([
          'plan_id',
          db.fn.sum('estimated_cost_dzd').as('actual_total'),
          db.fn.count('id').as('treatment_count'),
        ])
        .where('plan_id', 'in', planIds)
        .where('tenant_id', '=', req.tenantId)
        .groupBy('plan_id')
        .execute();
    }

    const aggMap = {};
    for (const agg of aggregates) {
      aggMap[agg.plan_id] = agg;
    }

    const plansWithDetails = plans.map(plan => ({
      ...plan,
      actual_total_dzd: aggMap[plan.id]?.actual_total || 0,
      treatment_count: parseInt(aggMap[plan.id]?.treatment_count || '0'),
    }));

    res.json({
      patient,
      appointments,
      treatments,
      invoices: invoicesWithPayments,
      plans: plansWithDetails,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

