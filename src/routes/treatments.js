const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

const VALID_TOOTH_NUMBERS = [
  '11', '12', '13', '14', '15', '16', '17', '18',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '31', '32', '33', '34', '35', '36', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48'
];

// Get treatment IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { patient_id, dentist_id, plan_id, start_date, end_date, treatment_type } = req.query;

    let query = db
      .selectFrom('treatment_records')
      .select(['treatment_records.id'])
      .where('treatment_records.tenant_id', '=', req.tenantId);

    if (patient_id) {
      query = query.where('treatment_records.patient_id', '=', patient_id);
    }

    if (dentist_id) {
      query = query.where('treatment_records.dentist_id', '=', dentist_id);
    }

    if (start_date) {
      query = query.where('treatment_records.treatment_date', '>=', start_date);
    }

    if (end_date) {
      query = query.where('treatment_records.treatment_date', '<=', end_date + ' 23:59:59');
    }

    if (plan_id) {
      query = query.where('treatment_records.plan_id', '=', plan_id);
    }

    if (treatment_type) {
      query = query.where('treatment_records.category_id', '=', treatment_type);
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const treatments = await query
      .orderBy('treatment_records.treatment_date', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const treatmentIds = treatments.map(t => t.id);
    if (pag.paginate) {
      const count = treatments.length > 0 ? Number(treatments[0].count) : 0;
      res.json(wrapPaginatedResponse(treatmentIds, count, pag.limit, pag.offset));
    } else {
      res.json(treatmentIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get treatments by IDs (batch)
router.get('/batch', async (req, res, next) => {
  try {
    const { ids } = req.query;
    if (!ids) {
      return res.status(400).json({ error: 'ids query parameter is required' });
    }

    const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
    if (idArray.length === 0) {
      return res.json([]);
    }

    const treatments = await db
      .selectFrom('treatment_records')
      .innerJoin('patients', 'treatment_records.patient_id', 'patients.id')
      .innerJoin('users', 'treatment_records.dentist_id', 'users.id')
      .select([
        'treatment_records.id',
        'treatment_records.patient_id',
        'treatment_records.appointment_id',
        'treatment_records.dentist_id',
        'treatment_records.category_id',
        'treatment_records.treatment_date',
        'treatment_records.tooth_number',
        'treatment_records.diagnosis',
        'treatment_records.treatment_performed',
        'treatment_records.notes',
        'treatment_records.estimated_cost_dzd',
        'treatment_records.created_at',
        'treatment_records.updated_at',
        'patients.full_name as patient_name',
        'patients.patient_code',
        'users.full_name as dentist_name'
      ])
      .where('treatment_records.id', 'in', idArray)
      .where('treatment_records.tenant_id', '=', req.tenantId)
      .execute();

    res.json(treatments);
  } catch (error) {
    next(error);
  }
});

// Get treatment by ID
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let treatment = await db
        .selectFrom('treatment_records')
        .innerJoin('patients', 'treatment_records.patient_id', 'patients.id')
        .innerJoin('users', 'treatment_records.dentist_id', 'users.id')
        .select([
          'treatment_records.id',
          'treatment_records.patient_id',
          'treatment_records.appointment_id',
          'treatment_records.dentist_id',
          'treatment_records.category_id',
          'treatment_records.treatment_date',
          'treatment_records.tooth_number',
          'treatment_records.diagnosis',
          'treatment_records.treatment_performed',
          'treatment_records.notes',
          'treatment_records.estimated_cost_dzd',
          'treatment_records.created_at',
          'treatment_records.updated_at',
          'patients.full_name as patient_name',
          'patients.patient_code',
          'users.full_name as dentist_name'
        ])
        .where('treatment_records.id', '=', req.params.id)
        .where('treatment_records.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!treatment) {
        treatment = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'treatment_records')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!treatment) {
          return res.status(404).json({ error: 'treatment.error.not_found' });
        }

        if (treatment.patient_id) {
          const patient = await db
            .selectFrom('patients')
            .select(['full_name', 'patient_code'])
            .where('id', '=', treatment.patient_id)
            .where('tenant_id', '=', req.tenantId)
            .executeTakeFirst();
          if (patient) {
            treatment.patient_name = patient.full_name;
            treatment.patient_code = patient.patient_code;
          }
        }

        if (treatment.dentist_id) {
          const dentist = await db
            .selectFrom('users')
            .select('full_name')
            .where('id', '=', treatment.dentist_id)
            .where('tenant_id', '=', req.tenantId)
            .executeTakeFirst();
          if (dentist) {
            treatment.dentist_name = dentist.full_name;
          }
        }
      }

      res.json(treatment);
    } catch (error) {
      next(error);
    }
  }
);

// Create treatment record
router.post('/',
  body('patient_id').optional().isUUID(),
  body('dentist_id').optional().isUUID(),
  body('treatment_date').optional().isISO8601(),
  body('diagnosis').notEmpty(),
  body('treatment_performed').notEmpty(),
  body('estimated_cost_dzd').isFloat({ min: 0 }),
  body('appointment_id').optional().isUUID(),
  body('plan_id').optional().isUUID(),
  body('category_id').optional().isUUID(),
  body('tooth_number').optional().isIn(VALID_TOOTH_NUMBERS),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, dentist_id, treatment_date, appointment_id, plan_id, category_id, tooth_number, diagnosis, treatment_performed, notes, estimated_cost_dzd } = req.body;

      const treatment = await db
        .insertInto('treatment_records')
        .values({
          patient_id,
          dentist_id,
          treatment_date,
          appointment_id: appointment_id || null,
          plan_id: plan_id || null,
          category_id: category_id || null,
          tooth_number: tooth_number || null,
          diagnosis,
          treatment_performed,
          notes: notes || null,
          estimated_cost_dzd,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      // Log the treatment creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'treatment_records',
          entityId: treatment.id,
          tenantId: req.tenantId,
          newValues: treatment
        }, db);
      }

      res.status(201).json(treatment);
    } catch (error) {
      next(error);
    }
  }
);

// Update treatment record
router.patch('/:id',
  param('id').isUUID(),
  body('patient_id').optional().isUUID(),
  body('dentist_id').optional().isUUID(),
  body('treatment_date').optional().isISO8601(),
  body('appointment_id').optional().isUUID(),
  body('plan_id').optional().isUUID(),
  body('category_id').optional().isUUID(),
  body('tooth_number').optional().isIn(VALID_TOOTH_NUMBERS),
  body('diagnosis').optional().notEmpty(),
  body('treatment_performed').optional().notEmpty(),
  body('estimated_cost_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      // Get current treatment for audit logging
      const currentTreatment = await db
        .selectFrom('treatment_records')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentTreatment) {
        return res.status(404).json({ error: 'treatment.error.not_found' });
      }

      if (res.conflictCheck(currentTreatment)) return;

      const { patient_id, dentist_id, treatment_date, appointment_id, plan_id, category_id, tooth_number, diagnosis, treatment_performed, notes, estimated_cost_dzd } = req.body;

      // Build update object with only provided fields
      const updateData = {};
      if (patient_id !== undefined) updateData.patient_id = patient_id;
      if (dentist_id !== undefined) updateData.dentist_id = dentist_id;
      if (treatment_date !== undefined) updateData.treatment_date = treatment_date;
      if (appointment_id !== undefined) updateData.appointment_id = appointment_id;
      if (plan_id !== undefined) updateData.plan_id = plan_id;
      if (category_id !== undefined) updateData.category_id = category_id;
      if (tooth_number !== undefined) updateData.tooth_number = tooth_number;
      if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
      if (treatment_performed !== undefined) updateData.treatment_performed = treatment_performed;
      if (notes !== undefined) updateData.notes = notes;
      if (estimated_cost_dzd !== undefined) updateData.estimated_cost_dzd = estimated_cost_dzd;
      updateData.updated_at = new Date();

      const treatment = await db
        .updateTable('treatment_records')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the treatment update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'treatment_records',
          entityId: treatment.id,
          tenantId: req.tenantId,
          oldValues: currentTreatment,
          newValues: treatment
        }, db);
      }

      res.json(treatment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete treatment record
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const treatment = await db
        .selectFrom('treatment_records')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!treatment) {
        return res.status(404).json({ error: 'treatment.error.not_found' });
      }

      await db
        .deleteFrom('treatment_records')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      // Log the deletion
      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'treatment_records',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: treatment
        }, db);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;