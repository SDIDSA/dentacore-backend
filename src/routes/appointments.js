const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');

const router = express.Router();

// Helper function to validate ISO8601 date
function isValidISO8601(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

router.use(authenticate);

// Get appointments
router.get('/', async (req, res, next) => {
  try {
    const { dentist_id, patient_id, date, status_key } = req.query;

    let query = db
      .selectFrom('appointments')
      .innerJoin('patients', 'appointments.patient_id', 'patients.id')
      .innerJoin('users', 'appointments.dentist_id', 'users.id')
      .select([
        'appointments.id',
        'appointments.patient_id',
        'appointments.dentist_id',
        'appointments.appointment_date',
        'appointments.duration_minutes',
        'appointments.status_key',
        'appointments.reason',
        'appointments.notes',
        'appointments.created_at',
        'patients.full_name as patient_name',
        'patients.phone as patient_phone',
        'users.full_name as dentist_name'
      ])
      .where('appointments.tenant_id', '=', req.tenantId);

    if (dentist_id) {
      query = query.where('appointments.dentist_id', '=', dentist_id);
    }

    if (patient_id) {
      query = query.where('appointments.patient_id', '=', patient_id);
    }

    if (date) {
      query = query.where(sql`DATE(appointments.appointment_date)`, '=', date);
    }

    if (status_key) {
      query = query.where('appointments.status_key', '=', status_key);
    }

    const appointments = await query
      .orderBy('appointments.appointment_date', 'asc')
      .execute();

    res.json({ appointments });
  } catch (error) {
    next(error);
  }
});

// Get appointments between start and end dates (inclusive)
router.get('/range',
  param('start_date').isISO8601(),
  param('end_date').isISO8601(),
  async (req, res, next) => {
    try {
      const { start_date, end_date, dentist_id, patient_id, status_key } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'validation.error', details: 'start_date and end_date are required' });
      }

      if (!isValidISO8601(start_date) || !isValidISO8601(end_date)) {
        return res.status(400).json({ error: 'validation.error', details: 'start_date and end_date must be valid ISO8601 dates' });
      }

      let end = end_date + ' 23:59:59';

      let query = db
        .selectFrom('appointments')
        .select(['appointments.id'])
        .where('appointments.appointment_date', '>=', start_date)
        .where('appointments.appointment_date', '<=', end)
        .where('appointments.tenant_id', '=', req.tenantId);

      if (dentist_id) {
        query = query.where('appointments.dentist_id', '=', dentist_id);
      }

      if (patient_id) {
        query = query.where('appointments.patient_id', '=', patient_id);
      }

      if (status_key) {
        query = query.where('appointments.status_key', '=', status_key);
      }

      const appointments = await query
        .orderBy('appointments.appointment_date', 'asc')
        .execute();

      const appointmentIds = appointments.map(appointment => appointment.id);
      res.json(appointmentIds);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const appointment = await db
        .selectFrom('appointments')
        .innerJoin('patients', 'appointments.patient_id', 'patients.id')
        .innerJoin('users', 'appointments.dentist_id', 'users.id')
        .select([
          'appointments.id',
          'appointments.patient_id',
          'appointments.dentist_id',
          'appointments.appointment_date',
          'appointments.duration_minutes',
          'appointments.status_key',
          'appointments.reason',
          'appointments.notes',
          'appointments.created_at',
          'patients.full_name as patient_name',
          'patients.phone as patient_phone',
          'users.full_name as dentist_name'
        ])
        .where('appointments.id', '=', req.params.id)
        .where('appointments.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!appointment) {
        return res.status(404).json({ error: 'appointment.error.not_found' });
      }

      res.json(appointment);
    } catch (error) {
      next(error);
    }
  }
);

// Create appointment
router.post('/',
  body('patient_id').isUUID(),
  body('dentist_id').isUUID(),
  body('appointment_date').isISO8601(),
  body('duration_minutes').isInt({ min: 1, max: 480 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, dentist_id, appointment_date, duration_minutes, reason, notes } = req.body;

      const appointment = await db
        .insertInto('appointments')
        .values({
          patient_id,
          dentist_id,
          appointment_date,
          duration_minutes,
          status_key: 'appt.status.scheduled',
          reason: reason || null,
          notes: notes || null,
          created_by: req.user.id,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      // Log the appointment creation
      await req.audit.log({
        action: 'CREATE',
        entityType: 'appointments',
        entityId: appointment.id,
        tenantId: req.tenantId,
        newValues: appointment
      }, db);

      res.status(201).json(appointment);
    } catch (error) {
      next(error);
    }
  }
);

// Update appointment
router.patch('/:id',
  param('id').isUUID(),
  body('patient_id').optional().isUUID(),
  body('dentist_id').optional().isUUID(),
  body('appointment_date').optional().isISO8601(),
  body('duration_minutes').optional().isInt({ min: 1, max: 480 }),
  body('status_key').optional().isIn([
    'appt.status.scheduled', 'appt.status.confirmed', 'appt.status.in_progress',
    'appt.status.completed', 'appt.status.cancelled', 'appt.status.no_show'
  ]),
  body('reason').optional().isString(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      // Get the current appointment for audit logging
      const currentAppointment = await db
        .selectFrom('appointments')
        .selectAll()
        .where('id', '=', req.params.id)
        .executeTakeFirst();

      if (!currentAppointment) {
        return res.status(404).json({ error: 'appointment.error.not_found' });
      }

      const { patient_id, dentist_id, appointment_date, duration_minutes, status_key, reason, notes } = req.body;

      // Build update object with only provided fields
      const updateData = {};
      if (patient_id !== undefined) updateData.patient_id = patient_id;
      if (dentist_id !== undefined) updateData.dentist_id = dentist_id;
      if (appointment_date !== undefined) updateData.appointment_date = appointment_date;
      if (duration_minutes !== undefined) updateData.duration_minutes = duration_minutes;
      if (status_key !== undefined) updateData.status_key = status_key;
      if (reason !== undefined) updateData.reason = reason;
      if (notes !== undefined) updateData.notes = notes;
      updateData.updated_at = new Date();

      const appointment = await db
        .updateTable('appointments')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the appointment update
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'appointments',
        entityId: appointment.id,
        tenantId: req.tenantId,
        oldValues: currentAppointment,
        newValues: appointment
      }, db);

      res.json(appointment);
    } catch (error) {
      next(error);
    }
  }
);

// Update appointment status
router.patch('/:id/status',
  body('status_key').isIn([
    'appt.status.scheduled', 'appt.status.confirmed', 'appt.status.in_progress',
    'appt.status.completed', 'appt.status.cancelled', 'appt.status.no_show'
  ]),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { status_key } = req.body;

      // Get the current appointment for audit logging
      const currentAppointment = await db
        .selectFrom('appointments')
        .selectAll()
        .where('id', '=', req.params.id)
        .executeTakeFirst();

      if (!currentAppointment) {
        return res.status(404).json({ error: 'appointment.error.not_found' });
      }

      const appointment = await db
        .updateTable('appointments')
        .set({
          status_key,
          updated_at: new Date()
        })
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the status update
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'appointments',
        entityId: appointment.id,
        tenantId: req.tenantId,
        oldValues: { status_key: currentAppointment.status_key },
        newValues: { status_key: appointment.status_key }
      }, db);

      res.json(appointment);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
