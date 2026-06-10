const express = require('express');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);

// Raw patient data endpoint
router.get('/patients/raw', async (req, res, next) => {
  try {
    const { start_date, end_date, status_key, search } = req.query;

    let query = db
      .selectFrom('patients')
      .selectAll()
      .where('patients.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('patients.created_at', '>=', start_date);
    }
    if (end_date) {
      query = query.where('patients.created_at', '<=', end_date + 'T23:59:59Z');
    }
    if (status_key) {
      query = query.where('patients.status_key', '=', status_key);
    }
    if (search) {
      query = query.where((qb) => qb
        .where('patients.full_name', 'ilike', `%${search}%`)
        .orWhere('patients.phone', 'ilike', `%${search}%`)
        .orWhere('patients.patient_code', 'ilike', `%${search}%`)
      );
    }

    const patients = await query
      .orderBy('patients.created_at', 'desc')
      .limit(parseInt(req.query.limit) || 100)
      .execute();

    res.json({ patients });
  } catch (error) {
    next(error);
  }
});

// Raw appointment data endpoint
router.get('/appointments/raw', async (req, res, next) => {
  try {
    const { start_date, end_date, status_key } = req.query;

    let query = db
      .selectFrom('appointments')
      .innerJoin('patients', 'appointments.patient_id', 'patients.id')
      .innerJoin('users', 'appointments.dentist_id', 'users.id')
      .select([
        'appointments.id',
        'appointments.appointment_date',
        'appointments.duration_minutes',
        'appointments.status_key',
        'appointments.reason',
        'patients.id as patient_id',
        'patients.full_name as patient_name',
        'patients.phone as patient_phone',
        'users.id as dentist_id',
        'users.full_name as dentist_name',
      ])
      .where('appointments.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('appointments.appointment_date', '>=', start_date);
    }
    if (end_date) {
      query = query.where('appointments.appointment_date', '<=', end_date + 'T23:59:59Z');
    }
    if (status_key) {
      query = query.where('appointments.status_key', '=', status_key);
    }

    const appointments = await query
      .orderBy('appointments.appointment_date', 'desc')
      .limit(parseInt(req.query.limit) || 100)
      .execute();

    res.json({ appointments });
  } catch (error) {
    next(error);
  }
});

// Raw treatment data endpoint
router.get('/treatments/raw', async (req, res, next) => {
  try {
    const { start_date, end_date, patient_id, dentist_id } = req.query;

    let query = db
      .selectFrom('treatment_records')
      .leftJoin('users', 'treatment_records.dentist_id', 'users.id')
      .leftJoin('patients', 'treatment_records.patient_id', 'patients.id')
      .select([
        'treatment_records.id',
        'treatment_records.treatment_date',
        'treatment_records.tooth_number',
        'treatment_records.diagnosis',
        'treatment_records.treatment_performed',
        'treatment_records.notes',
        'treatment_records.estimated_cost_dzd',
        'treatment_records.patient_id',
        'treatment_records.dentist_id',
        'users.full_name as dentist_name',
        'patients.full_name as patient_name',
      ])
      .where('treatment_records.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('treatment_records.treatment_date', '>=', start_date);
    }
    if (end_date) {
      query = query.where('treatment_records.treatment_date', '<=', end_date + 'T23:59:59Z');
    }
    if (patient_id) {
      query = query.where('treatment_records.patient_id', '=', patient_id);
    }
    if (dentist_id) {
      query = query.where('treatment_records.dentist_id', '=', dentist_id);
    }

    const treatments = await query
      .orderBy('treatment_records.treatment_date', 'desc')
      .limit(parseInt(req.query.limit) || 100)
      .execute();

    res.json({ treatments });
  } catch (error) {
    next(error);
  }
});

// Raw payment data endpoint
router.get('/payments/raw', async (req, res, next) => {
  try {
    const { start_date, end_date, payment_method, patient_id } = req.query;

    let query = db
      .selectFrom('payments')
      .leftJoin('patients', 'payments.patient_id', 'patients.id')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .select([
        'payments.id',
        'payments.amount_dzd',
        'payments.payment_date',
        'payments.payment_method',
        'payments.reference_number',
        'payments.notes',
        'payments.patient_id',
        'payments.invoice_id',
        'patients.full_name as patient_name',
        'invoices.invoice_number',
      ])
      .where('payments.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('payments.payment_date', '>=', start_date);
    }
    if (end_date) {
      query = query.where('payments.payment_date', '<=', end_date + 'T23:59:59Z');
    }
    if (payment_method) {
      query = query.where('payments.payment_method', '=', payment_method);
    }
    if (patient_id) {
      query = query.where('payments.patient_id', '=', patient_id);
    }

    const payments = await query
      .orderBy('payments.payment_date', 'desc')
      .limit(parseInt(req.query.limit) || 100)
      .execute();

    res.json({ payments });
  } catch (error) {
    next(error);
  }
});

// Get today's appointments with details
router.get('/appointments/today', async (req, res, next) => {

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appointments = await db
      .selectFrom('appointments')
      .innerJoin('patients', 'appointments.patient_id', 'patients.id')
      .innerJoin('users', 'appointments.dentist_id', 'users.id')
      .select([
        'appointments.id',
        'appointments.appointment_date',
        'appointments.duration_minutes',
        'appointments.status_key',
        'appointments.reason',
        'patients.full_name as patient_name',
        'patients.phone as patient_phone',
        'users.full_name as dentist_name'
      ])
      .where('appointments.appointment_date', '>=', today.toISOString())
      .where('appointments.appointment_date', '<', tomorrow.toISOString())
      .orderBy('appointments.appointment_date', 'asc')
      .execute();

    res.json(appointments);
  } catch (error) {
    next(error);
  }

});



// Get recent activity for dashboard
router.get('/recent-activity', async (req, res, next) => {

  try {
    const limit = parseInt(req.query.limit) || 20;
    const days = parseInt(req.query.days) || 7;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get recent audit logs with user information - raw data
    const recentActivity = await db
      .selectFrom('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select([
        'audit_logs.id',
        'audit_logs.action',
        'audit_logs.entity_type',
        'audit_logs.entity_id',
        'audit_logs.old_values',
        'audit_logs.new_values',
        'audit_logs.ip_address',
        'audit_logs.user_agent',
        'audit_logs.created_at',
        'users.full_name as user_name',
        'users.email as user_email'
      ])
      .where('audit_logs.tenant_id', '=', req.tenantId)
      .where('audit_logs.created_at', '>=', cutoffDate.toISOString())
      .orderBy('audit_logs.created_at', 'desc')
      .limit(limit)
      .execute();

    res.json(recentActivity);
  } catch (error) {
    next(error);
  }

});

module.exports = router;
