const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');

const router = express.Router();

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
        sql`patients.first_name || ' ' || patients.last_name`.as('patient_name'),
        'users.full_name as dentist_name'
      ]);

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

// Create appointment
router.post('/',
  body('patient_id').isUUID(),
  body('dentist_id').isUUID(),
  body('appointment_date').isISO8601(),
  body('duration_minutes').isInt({ min: 1, max: 480 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log(errors)
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

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
          created_by: req.user.id
        })
        .returningAll()
        .executeTakeFirst();

      res.status(201).json(appointment);
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
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const appointment = await db
        .updateTable('appointments')
        .set({ 
          status_key: req.body.status_key,
          updated_at: new Date()
        })
        .where('id', '=', req.params.id)
        .returningAll()
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

module.exports = router;
