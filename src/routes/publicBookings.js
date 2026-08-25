// Public, unauthenticated booking API for the web portal.
//
// Mounted at /api/v1/public — every path starts with /:clinic (the tenant
// subdomain slug), resolved by tenantBySlug into req.tenantId. From there the
// exact same tenancy rules apply as everywhere else in the API.
//
// Endpoints:
//   GET  /:clinic/dentists   active dentists (id + name only)
//   GET  /:clinic/services   bookable treatment categories (global + own)
//   GET  /:clinic/slots      free slots for ?date=YYYY-MM-DD[&dentist_id=]
//   POST /:clinic/bookings   guest booking -> patient stub + appointment
//
// Abuse controls: strictMutationLimiter (10/min/IP, safe methods skip) on the
// whole router under apiLimiter (60/min), duplicate-phone guard, one-active-
 // appointment-per-slot enforced by uq_appt_active_slot in the schema.

const express = require('express');
const { body, query } = require('express-validator');
const { sql } = require('kysely');
const db = require('../config/database');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');
const { tenantBySlug } = require('../middleware/tenantBySlug');
const { strictMutationLimiter } = require('../middleware/rateLimiter');
const { getDayAvailability, algiersNow } = require('../utils/availability');

const router = express.Router({ mergeParams: true });

const PHONE_RE = /^\+213[0-9]{9}$/; // same as chk_patient_phone on patients

// NOTE: the :clinic segment must live on these `use` calls — a bare
// router.use(fn) matches every request but captures no params.
router.use('/:clinic', strictMutationLimiter);
router.use('/:clinic', tenantBySlug);

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'validation.error', details: errors.array().map((e) => e.msg) });
    return false;
  }
  return true;
}

// --------------------------------------------------------------------------
// GET /:clinic/dentists
// --------------------------------------------------------------------------
router.get(
  '/:clinic/dentists',
  async (req, res, next) => {
    try {
      const dentists = await db
        .selectFrom('users as u')
        .innerJoin('roles as r', 'u.role_id', 'r.id')
        .select(['u.id', 'u.full_name'])
        .where('u.tenant_id', '=', req.tenantId)
        .where('r.role_key', '=', 'auth.role.dentist')
        .where('u.status_key', '=', 'user.status.active')
        .orderBy('u.full_name')
        .execute();
      res.json(dentists);
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// GET /:clinic/services
// --------------------------------------------------------------------------
router.get(
  '/:clinic/services',
  async (req, res, next) => {
    try {
      const services = await db
        .selectFrom('treatment_categories as tc')
        .select(['tc.id', 'tc.category_key', 'tc.description'])
        .select(sql`CASE WHEN tc.tenant_id IS NULL THEN true ELSE false END`.as('is_global'))
        .where((eb) =>
          eb.or([eb('tc.tenant_id', 'is', null), eb('tc.tenant_id', '=', req.tenantId)])
        )
        .where('tc.is_active', '=', true)
        .orderBy('tc.category_key')
        .execute();
      res.json(services);
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// GET /:clinic/slots?date=YYYY-MM-DD[&dentist_id=UUID]
// --------------------------------------------------------------------------
router.get(
  '/:clinic/slots',
  query('date').isISO8601({ strict: true }).withMessage('date must be YYYY-MM-DD'),
  query('dentist_id').optional().isUUID(),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const date = String(req.query.date).slice(0, 10);
      const now = algiersNow();
      const max = new Date(Date.now() + 31 * 86400000 + 3600000).toISOString().slice(0, 10);
      if (date < now.date || date > max) {
        return res.status(400).json({ error: 'validation.error', details: ['date must be today..+31 days'] });
      }
      const availability = await getDayAvailability({
        tenantId: req.tenantId,
        date,
        dentistId: req.query.dentist_id || null,
      });
      res.json({ date, availability });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// POST /:clinic/bookings
// --------------------------------------------------------------------------
router.post(
  '/:clinic/bookings',
  body('full_name').isString().trim().isLength({ min: 2, max: 120 }),
  body('phone').matches(PHONE_RE).withMessage('phone must match +213XXXXXXXXX'),
  body('dentist_id').isUUID(),
  body('appointment_date').isISO8601(),
  body('category_id').optional().isUUID(),
  body('notes').optional().isString().trim().isLength({ max: 500 }),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return;
    try {
      const { full_name, phone, dentist_id, category_id, notes } = req.body;

      // normalize requested instant; Algiers wall time must land on :00/:30-style slot
      const when = new Date(req.body.appointment_date);
      if (Number.isNaN(when.getTime()) || when.getUTCSeconds() !== 0 || when.getUTCMilliseconds() !== 0) {
        return res.status(400).json({ error: 'validation.error', details: ['appointment_date must be minute-precision ISO'] });
      }
      const date = new Date(when.getTime() + 3600000).toISOString().slice(0, 10); // Algiers day
      const hhmm = `${String(new Date(when.getTime() + 3600000).getUTCHours()).padStart(2, '0')}:${String(new Date(when.getTime() + 3600000).getUTCMinutes()).padStart(2, '0')}`;

      // 1. dentist must belong to THIS tenant and be an active dentist
      const dentist = await db
        .selectFrom('users as u')
        .innerJoin('roles as r', 'u.role_id', 'r.id')
        .select(['u.id'])
        .where('u.id', '=', dentist_id)
        .where('u.tenant_id', '=', req.tenantId)
        .where('r.role_key', '=', 'auth.role.dentist')
        .where('u.status_key', '=', 'user.status.active')
        .executeTakeFirst();
      if (!dentist) {
        return res.status(400).json({ error: 'public.booking.dentist_unavailable' });
      }

      // 2. requested time must be one of the currently free slots
      const availability = await getDayAvailability({ tenantId: req.tenantId, date, dentistId: dentist_id });
      const group = availability.find((g) => g.slots.includes(hhmm));
      if (!group) {
        return res.status(409).json({ error: 'public.booking.slot_unavailable' });
      }

      // 3. duplicate-phone guard: max 1 upcoming booking per phone number
      const upcoming = await db
        .selectFrom('appointments as a')
        .innerJoin('patients as p', 'a.patient_id', 'p.id')
        .select('a.id')
        .where('p.tenant_id', '=', req.tenantId)
        .where('p.phone', '=', phone)
        .where('a.status_key', 'not in', ['appt.status.cancelled', 'appt.status.no_show'])
        .where('a.appointment_date', '>=', new Date())
        .limit(1)
        .execute();
      if (upcoming.length) {
        return res.status(409).json({ error: 'public.booking.limit_reached' });
      }

      // 4. optional service category must be global or ours
      let reason = null;
      if (category_id) {
        const cat = await db
          .selectFrom('treatment_categories')
          .select(['category_key'])
          .where('id', '=', category_id)
          .where((eb) =>
            eb.or([eb('tenant_id', 'is', null), eb('tenant_id', '=', req.tenantId)])
          )
          .where('is_active', '=', true)
          .executeTakeFirst();
        if (!cat) return res.status(400).json({ error: 'validation.error', details: ['unknown category'] });
        reason = cat.category_key;
      }

      // 5. guest patient stub (staff completes profile at first visit)
      const year = new Date().getFullYear();
      const [{ maxnum }] = await db
        .selectFrom('patients')
        .select(sql`COALESCE(MAX(CAST(SUBSTRING(patient_code FROM '[0-9]+$') AS INTEGER)), 0)`.as('maxnum'))
        .where('patient_code', 'like', `PAT-${year}-%`)
        .where('tenant_id', '=', req.tenantId)
        .execute();
      const patient_code = `PAT-${year}-${String(Number(maxnum) + 1).padStart(4, '0')}`;

      const patient = await db
        .insertInto('patients')
        .values({
          tenant_id: req.tenantId,
          patient_code,
          full_name: full_name.trim(),
          phone,
        })
        .returningAll()
        .executeTakeFirst();

      // 6. appointment; uq_appt_active_slot arbitrates concurrent grabs
      let appointment;
      try {
        appointment = await db
          .insertInto('appointments')
          .values({
            tenant_id: req.tenantId,
            patient_id: patient.id,
            dentist_id,
            appointment_date: when,
            duration_minutes: group.slot_minutes,
            status_key: 'appt.status.scheduled',
            reason,
            notes: notes || null,
          })
          .returningAll()
          .executeTakeFirst();
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: 'public.booking.slot_taken' });
        }
        throw err;
      }

      logger.info('public booking created', {
        requestId: req.requestId,
        tenant: req.tenant.subdomain,
        appointmentId: appointment.id,
      });

      res.status(201).json({
        id: appointment.id,
        patient_code: patient.patient_code,
        appointment_date: appointment.appointment_date,
        duration_minutes: appointment.duration_minutes,
        status_key: appointment.status_key,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
