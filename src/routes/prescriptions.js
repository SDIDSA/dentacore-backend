const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { sql } = require('kysely');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

const SORT_FIELDS_MAP = {
  created_at: 'prescriptions.created_at',
  medication_name: 'prescriptions.medication_name',
  status_key: 'prescriptions.status_key',
  updated_at: 'prescriptions.updated_at',
};
const SORT_ORDERS = ['asc', 'desc'];

// Search prescriptions
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '');
    const results = await db
      .selectFrom('prescriptions')
      .select('prescriptions.id')
      .innerJoin('patients', 'prescriptions.patient_id', 'patients.id')
      .where('prescriptions.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('prescriptions.medication_name', 'ilike', `%${sanitized}%`),
          eb('prescriptions.prescription_number', 'ilike', `%${sanitized}%`),
          eb('patients.full_name', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

router.get('/',
  query('patient_id').optional().isUUID(),
  query('search').optional().isString(),
  query('sort_by').optional().isIn(Object.keys(SORT_FIELDS_MAP)),
  query('sort_order').optional().isIn(SORT_ORDERS),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const pag = parsePagination(req);
      const { patient_id, search, sort_by, sort_order } = req.query;

      let query = db
        .selectFrom('prescriptions')
        .select([
          'prescriptions.id',
          'prescriptions.prescription_number',
          'prescriptions.medication_name',
          'prescriptions.dosage',
          'prescriptions.frequency',
          'prescriptions.duration',
          'prescriptions.status_key',
          'prescriptions.patient_id',
          'prescriptions.dentist_id',
          'prescriptions.notes',
          'prescriptions.created_at',
          'prescriptions.updated_at',
        ])
        .where('prescriptions.tenant_id', '=', req.tenantId);

      if (patient_id) {
        query = query.where('prescriptions.patient_id', '=', patient_id);
      }

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('prescriptions.medication_name', 'ilike', `%${search}%`),
          ])
        );
      }

      if (pag.paginate) {
        query = query.select([sql`COUNT(*) OVER()`.as('count')]);
      }

      const sortField = sort_by && SORT_FIELDS_MAP[sort_by] ? SORT_FIELDS_MAP[sort_by] : 'prescriptions.created_at';
      const sortDir = sort_order && SORT_ORDERS.includes(sort_order) ? sort_order : 'desc';

      const items = await query
        .orderBy(sortField, sortDir)
        .limit(pag.paginate ? pag.limit : null)
        .offset(pag.paginate ? pag.offset : null)
        .execute();

      const ids = items.map(p => p.id);
      if (pag.paginate) {
        const total = items.length > 0 ? Number(items[0].count) : 0;
        res.json(wrapPaginatedResponse(ids, total, pag.limit, pag.offset));
      } else {
        res.json(ids);
      }
    } catch (error) {
      next(error);
    }
  }
);

router.get('/batch',
  query('ids').optional().isString(),
  async (req, res, next) => {
    try {
      const { ids } = req.query;
      if (!ids) {
        return res.status(400).json({ error: 'ids query parameter is required' });
      }

      const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
      if (idArray.length === 0) {
        return res.json([]);
      }

      const items = await db
        .selectFrom('prescriptions')
        .leftJoin('patients', 'prescriptions.patient_id', 'patients.id')
        .select([
          'prescriptions.id',
          'prescriptions.prescription_number',
          'prescriptions.medication_name',
          'prescriptions.dosage',
          'prescriptions.frequency',
          'prescriptions.duration',
          'prescriptions.notes',
          'prescriptions.status_key',
          'prescriptions.patient_id',
          'prescriptions.dentist_id',
          'prescriptions.created_by',
          'prescriptions.created_at',
          'prescriptions.updated_at',
          'patients.full_name as patient_name',
        ])
        .where('prescriptions.id', 'in', idArray)
        .where('prescriptions.tenant_id', '=', req.tenantId)
        .execute();

      res.json(items);
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

      const item = await db
        .selectFrom('prescriptions')
        .leftJoin('patients', 'prescriptions.patient_id', 'patients.id')
        .select([
          'prescriptions.id',
          'prescriptions.prescription_number',
          'prescriptions.medication_name',
          'prescriptions.dosage',
          'prescriptions.frequency',
          'prescriptions.duration',
          'prescriptions.notes',
          'prescriptions.status_key',
          'prescriptions.patient_id',
          'prescriptions.dentist_id',
          'prescriptions.created_by',
          'prescriptions.created_at',
          'prescriptions.updated_at',
          'patients.full_name as patient_name',
        ])
        .where('prescriptions.id', '=', req.params.id)
        .where('prescriptions.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!item) {
        return res.status(404).json({ error: 'prescription.error.not_found' });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

router.post('/',
  body('patient_id').isUUID(),
  body('medication_name').trim().notEmpty(),
  body('dosage').trim().notEmpty(),
  body('frequency').trim().notEmpty(),
  body('duration').optional().isString(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, medication_name, dosage, frequency, duration, notes } = req.body;

      // Generate prescription number (RX-YYYYMM-NNNN)
      const now = new Date();
      const yearStr = now.getFullYear().toString();
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const prefix = 'RX-' + yearStr + monthStr + '-';

      const lastRow = await db
        .selectFrom('prescriptions')
        .select('prescription_number')
        .where('tenant_id', '=', req.tenantId)
        .where('prescription_number', 'like', prefix + '%')
        .orderBy('prescription_number', 'desc')
        .executeTakeFirst();

      let seq = 1;
      if (lastRow) {
        const lastSeq = Number.parseInt(lastRow.prescription_number.substring(prefix.length), 10);
        if (!Number.isNaN(lastSeq)) seq = lastSeq + 1;
      }
      const prescriptionNumber = prefix + String(seq).padStart(4, '0');

      const item = await db
        .insertInto('prescriptions')
        .values({
          tenant_id: req.tenantId,
          patient_id,
          dentist_id: req.user.id,
          medication_name,
          dosage,
          frequency,
          prescription_number: prescriptionNumber,
          duration: duration || null,
          notes: notes || null,
          created_by: req.user.id,
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'prescriptions',
          entityId: item.id,
          tenantId: req.tenantId,
          newValues: item,
        });
      }

      const patient = await db
        .selectFrom('patients')
        .select('full_name')
        .where('id', '=', patient_id)
        .executeTakeFirst();

      res.status(201).json({ ...item, patient_name: patient?.full_name || null });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/:id',
  param('id').isUUID(),
  body('medication_name').optional().trim().notEmpty(),
  body('dosage').optional().trim().notEmpty(),
  body('frequency').optional().trim().notEmpty(),
  body('duration').optional().isString(),
  body('notes').optional().isString(),
  body('status_key').optional().isIn([
    'prescription.status.active', 'prescription.status.completed', 'prescription.status.cancelled'
  ]),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const current = await db
        .selectFrom('prescriptions')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'prescription.error.not_found' });
      }

      if (res.conflictCheck(current)) return;

      const { medication_name, dosage, frequency, duration, notes, status_key } = req.body;
      const updateData = {};
      if (medication_name !== undefined) updateData.medication_name = medication_name;
      if (dosage !== undefined) updateData.dosage = dosage;
      if (frequency !== undefined) updateData.frequency = frequency;
      if (duration !== undefined) updateData.duration = duration;
      if (notes !== undefined) updateData.notes = notes;
      if (status_key !== undefined) updateData.status_key = status_key;

      if (Object.keys(updateData).length === 0) {
        return res.json(current);
      }
      updateData.updated_at = new Date();

      const item = await db
        .updateTable('prescriptions')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'prescriptions',
          entityId: item.id,
          tenantId: req.tenantId,
          oldValues: current,
          newValues: item,
        });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const item = await db
        .selectFrom('prescriptions')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!item) {
        return res.status(404).json({ error: 'prescription.error.not_found' });
      }

      await db
        .deleteFrom('prescriptions')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      item.status_key = 'prescription.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'prescriptions',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: item,
        });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
