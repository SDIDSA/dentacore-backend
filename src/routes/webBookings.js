const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { emitToTenant } = require('../socket');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

// GET /pending-count - Quick unread/pending count for UI badges
router.get('/pending-count', async (req, res, next) => {
  try {
    const result = await db
      .selectFrom('web_bookings')
      .select(sql`count(*)`.as('count'))
      .where('tenant_id', '=', req.tenantId)
      .where('status_key', '=', 'web_booking.status.pending')
      .executeTakeFirst()
      .catch(() => ({ count: 0 }));

    res.json({ count: Number(result?.count || 0) });
  } catch (err) {
    next(err);
  }
});

// GET / - List web bookings for tenant
router.get(
  '/',
  query('status_key').optional().isIn([
    'web_booking.status.pending',
    'web_booking.status.approved',
    'web_booking.status.rejected'
  ]),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const pag = parsePagination(req);
      const { status_key } = req.query;

      let baseQuery = db
        .selectFrom('web_bookings as wb')
        .where('wb.tenant_id', '=', req.tenantId);

      if (status_key) {
        baseQuery = baseQuery.where('wb.status_key', '=', status_key);
      }

      const totalCountRow = await baseQuery
        .select(sql`count(*)`.as('total_count'))
        .executeTakeFirst();
      const total = Number(totalCountRow?.total_count || 0);

      let queryBuilder = baseQuery
        .leftJoin('users as d', 'wb.dentist_id', 'd.id')
        .leftJoin('treatment_categories as tc', 'wb.category_id', 'tc.id')
        .leftJoin('users as r', 'wb.reviewed_by', 'r.id')
        .leftJoin('patients as p', 'wb.created_patient_id', 'p.id')
        .leftJoin('appointments as a', 'wb.created_appointment_id', 'a.id')
        .select([
          'wb.id',
          'wb.tenant_id',
          'wb.full_name',
          'wb.phone',
          'wb.dentist_id',
          'd.full_name as dentist_name',
          'wb.category_id',
          'tc.category_key',
          'tc.description as category_description',
          'wb.appointment_date',
          'wb.duration_minutes',
          'wb.status_key',
          'wb.notes',
          'wb.created_patient_id',
          'p.patient_code as created_patient_code',
          'wb.created_appointment_id',
          'wb.reviewed_by',
          'r.full_name as reviewer_name',
          'wb.reviewed_at',
          'wb.rejection_reason',
          'wb.created_at',
          'wb.updated_at'
        ])
        .orderBy('wb.created_at', 'desc');

      if (pag.paginate) {
        queryBuilder = queryBuilder.offset(pag.offset).limit(pag.limit);
      }

      const items = await queryBuilder.execute();

      if (pag.paginate) {
        res.json(wrapPaginatedResponse(items, total, pag.limit, pag.offset));
      } else {
        res.json(items);
      }
    } catch (err) {
      next(err);
    }
  }
);

// GET /:id - Get single web booking
router.get('/:id', param('id').isUUID(), async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'validation.error', details: errors.array() });
  }

  try {
    const booking = await db
      .selectFrom('web_bookings as wb')
      .leftJoin('users as d', 'wb.dentist_id', 'd.id')
      .leftJoin('treatment_categories as tc', 'wb.category_id', 'tc.id')
      .leftJoin('users as r', 'wb.reviewed_by', 'r.id')
      .leftJoin('patients as p', 'wb.created_patient_id', 'p.id')
      .leftJoin('appointments as a', 'wb.created_appointment_id', 'a.id')
      .select([
        'wb.id',
        'wb.tenant_id',
        'wb.full_name',
        'wb.phone',
        'wb.dentist_id',
        'd.full_name as dentist_name',
        'wb.category_id',
        'tc.category_key',
        'tc.description as category_description',
        'wb.appointment_date',
        'wb.duration_minutes',
        'wb.status_key',
        'wb.notes',
        'wb.created_patient_id',
        'p.patient_code as created_patient_code',
        'wb.created_appointment_id',
        'wb.reviewed_by',
        'r.full_name as reviewer_name',
        'wb.reviewed_at',
        'wb.rejection_reason',
        'wb.created_at',
        'wb.updated_at'
      ])
      .where('wb.id', '=', req.params.id)
      .where('wb.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!booking) {
      return res.status(404).json({ error: 'web_booking.error.not_found' });
    }

    res.json(booking);
  } catch (err) {
    next(err);
  }
});

// POST /:id/approve - Approve web booking and create official patient & appointment
router.post(
  '/:id/approve',
  param('id').isUUID(),
  body('patient_id').optional().isUUID(),
  body('dentist_id').optional().isUUID(),
  body('category_id').optional().isUUID(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const booking = await db
        .selectFrom('web_bookings')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!booking) {
        return res.status(404).json({ error: 'web_booking.error.not_found' });
      }

      if (booking.status_key !== 'web_booking.status.pending') {
        return res.status(409).json({ error: 'web_booking.error.already_processed' });
      }

      const { patient_id, dentist_id, category_id, notes } = req.body;
      const targetDentistId = dentist_id || booking.dentist_id;
      const targetCategoryId = category_id !== undefined ? category_id : booking.category_id;
      const targetNotes = notes !== undefined ? notes : booking.notes;

      const result = await db.transaction().execute(async (trx) => {
        await sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`.execute(trx);

        // 1. Resolve or create patient
        let patientToUse;
        if (patient_id) {
          patientToUse = await trx
            .selectFrom('patients')
            .selectAll()
            .where('id', '=', patient_id)
            .where('tenant_id', '=', req.tenantId)
            .executeTakeFirst();
          if (!patientToUse) {
            throw new Error('patient.error.not_found');
          }
        } else {
          // Check if patient with identical phone exists in tenant
          patientToUse = await trx
            .selectFrom('patients')
            .selectAll()
            .where('phone', '=', booking.phone)
            .where('tenant_id', '=', req.tenantId)
            .executeTakeFirst();

          if (!patientToUse) {
            // Generate next sequential patient code PAT-YYYY-XXXX
            const year = new Date().getFullYear();
            const highestCodeResult = await trx
              .selectFrom('patients')
              .select(sql`MAX(CAST(SUBSTRING(patient_code FROM '[0-9]+$') AS INTEGER))`.as('maxnum'))
              .where('patient_code', 'like', `PAT-${year}-%`)
              .where('tenant_id', '=', req.tenantId)
              .executeTakeFirst();

            const nextNum = Number(highestCodeResult?.maxnum ?? 0) + 1;
            const patient_code = `PAT-${year}-${String(nextNum).padStart(4, '0')}`;

            patientToUse = await trx
              .insertInto('patients')
              .values({
                tenant_id: req.tenantId,
                patient_code,
                full_name: booking.full_name,
                phone: booking.phone,
                remarks: booking.notes ? `Réservation en ligne: ${booking.notes}` : 'Réservation en ligne',
                created_by: req.user.id
              })
              .returningAll()
              .executeTakeFirst();
          }
        }

        // 2. Resolve category reason if category present
        let reason = null;
        if (targetCategoryId) {
          const cat = await trx
            .selectFrom('treatment_categories')
            .select('category_key')
            .where('id', '=', targetCategoryId)
            .executeTakeFirst();
          if (cat) reason = cat.category_key;
        }

        // 3. Create official appointment
        const appointment = await trx
          .insertInto('appointments')
          .values({
            tenant_id: req.tenantId,
            patient_id: patientToUse.id,
            dentist_id: targetDentistId,
            category_id: targetCategoryId || null,
            appointment_date: booking.appointment_date,
            duration_minutes: booking.duration_minutes,
            status_key: 'appt.status.confirmed',
            reason,
            notes: targetNotes || null,
            created_by: req.user.id
          })
          .returningAll()
          .executeTakeFirst();

        // 4. Update web booking status
        const updatedBooking = await trx
          .updateTable('web_bookings')
          .set({
            status_key: 'web_booking.status.approved',
            created_patient_id: patientToUse.id,
            created_appointment_id: appointment.id,
            reviewed_by: req.user.id,
            reviewed_at: new Date(),
            updated_at: new Date()
          })
          .where('id', '=', booking.id)
          .where('tenant_id', '=', req.tenantId)
          .returningAll()
          .executeTakeFirst();

        return { booking: updatedBooking, patient: patientToUse, appointment };
      });

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'web_bookings',
          entityId: result.booking.id,
          tenantId: req.tenantId,
          newValues: { status_key: 'web_booking.status.approved', appointment_id: result.appointment.id }
        });
      }

      emitToTenant(req.tenantId, 'web_booking_approved', result.booking);
      emitToTenant(req.tenantId, 'appointment_created', result.appointment);

      res.json(result);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'appointment.error.slot_conflict' });
      }
      next(err);
    }
  }
);

// POST /:id/reject - Reject web booking
router.post(
  '/:id/reject',
  param('id').isUUID(),
  body('rejection_reason').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const booking = await db
        .selectFrom('web_bookings')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!booking) {
        return res.status(404).json({ error: 'web_booking.error.not_found' });
      }

      if (booking.status_key !== 'web_booking.status.pending') {
        return res.status(409).json({ error: 'web_booking.error.already_processed' });
      }

      const { rejection_reason } = req.body;

      const updatedBooking = await db
        .updateTable('web_bookings')
        .set({
          status_key: 'web_booking.status.rejected',
          rejection_reason: rejection_reason || null,
          reviewed_by: req.user.id,
          reviewed_at: new Date(),
          updated_at: new Date()
        })
        .where('id', '=', booking.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'web_bookings',
          entityId: updatedBooking.id,
          tenantId: req.tenantId,
          newValues: { status_key: 'web_booking.status.rejected', rejection_reason }
        });
      }

      emitToTenant(req.tenantId, 'web_booking_rejected', updatedBooking);

      res.json(updatedBooking);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
