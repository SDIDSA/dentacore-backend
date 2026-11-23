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

async function tenantRefExists(tenantId, table, id) {
  const row = await db
    .selectFrom(table)
    .select('id')
    .where('id', '=', id)
    .where('tenant_id', '=', tenantId)
    .executeTakeFirst();
  return !!row;
}

function escapeIlike(str) {
  return String(str).replace(/([\\%_])/g, '\\$1');
}

const SORT_FIELDS_MAP = {
  created_at: 'prescriptions.created_at',
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
      .leftJoin('prescription_items', 'prescriptions.id', 'prescription_items.prescription_id')
      .where('prescriptions.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('prescription_items.medication_name', 'ilike', `%${sanitized}%`),
          eb('prescriptions.prescription_number', 'ilike', `%${sanitized}%`),
          eb('patients.full_name', 'ilike', `%${sanitized}%`),
        ])
      )
      .distinct()
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

// List prescriptions
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

      let qb = db
        .selectFrom('prescriptions')
        .select([
          'prescriptions.id',
          'prescriptions.prescription_number',
          'prescriptions.status_key',
          'prescriptions.patient_id',
          'prescriptions.dentist_id',
          'prescriptions.notes',
          'prescriptions.created_at',
          'prescriptions.updated_at',
        ])
        .where('prescriptions.tenant_id', '=', req.tenantId);

      if (patient_id) {
        qb = qb.where('prescriptions.patient_id', '=', patient_id);
      }

      if (search) {
        qb = qb
          .leftJoin('prescription_items', 'prescriptions.id', 'prescription_items.prescription_id')
          .where((eb) =>
            eb.or([
              eb('prescription_items.medication_name', 'ilike', `%${escapeIlike(search)}%`),
              eb('prescriptions.prescription_number', 'ilike', `%${escapeIlike(search)}%`),
            ])
          )
          .distinct();
      }

      if (pag.paginate) {
        qb = qb.select([sql`COUNT(*) OVER()`.as('count')]);
      }

      const sortField = sort_by && SORT_FIELDS_MAP[sort_by] ? SORT_FIELDS_MAP[sort_by] : 'prescriptions.created_at';
      const sortDir = sort_order && SORT_ORDERS.includes(sort_order) ? sort_order : 'desc';

      const items = await qb
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

// Get prescriptions by IDs (batch)
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

      const prescriptions = await db
        .selectFrom('prescriptions')
        .leftJoin('patients', 'prescriptions.patient_id', 'patients.id')
        .select([
          'prescriptions.id',
          'prescriptions.prescription_number',
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

      if (prescriptions.length === 0) {
        return res.json([]);
      }

      const pIds = prescriptions.map(p => p.id);
      const allItems = await db
        .selectFrom('prescription_items')
        .selectAll()
        .where('prescription_id', 'in', pIds)
        .where('tenant_id', '=', req.tenantId)
        .orderBy('created_at', 'asc')
        .execute();

      const itemsByPrescription = {};
      for (const it of allItems) {
        if (!itemsByPrescription[it.prescription_id]) itemsByPrescription[it.prescription_id] = [];
        itemsByPrescription[it.prescription_id].push(it);
      }

      for (const p of prescriptions) {
        p.items = itemsByPrescription[p.id] || [];
        if (p.items.length > 0) {
          p.medication_name = p.items[0].medication_name;
          p.dosage = p.items[0].dosage;
          p.frequency = p.items[0].frequency_key;
          p.duration = String(p.items[0].duration_days);
        }
      }

      res.json(prescriptions);
    } catch (error) {
      next(error);
    }
  }
);

// Get single prescription
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

      const items = await db
        .selectFrom('prescription_items')
        .selectAll()
        .where('prescription_id', '=', item.id)
        .where('tenant_id', '=', req.tenantId)
        .orderBy('created_at', 'asc')
        .execute();

      item.items = items;
      if (items.length > 0) {
        item.medication_name = items[0].medication_name;
        item.dosage = items[0].dosage;
        item.frequency = items[0].frequency_key;
        item.duration = String(items[0].duration_days);
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Create prescription (supports multi-drug line items and legacy single-drug fallback)
router.post('/',
  body('patient_id').isUUID(),
  body('items').optional().isArray({ min: 1 }),
  body('items.*.medication_name').optional().trim().notEmpty(),
  body('items.*.dosage').optional().trim().notEmpty(),
  body('medication_name').optional().trim(),
  body('dosage').optional().trim(),
  body('notes').optional().isString(),
  body('status_key').optional().isIn([
    'prescription.status.active', 'prescription.status.completed', 'prescription.status.cancelled'
  ]),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, notes, status_key } = req.body;

      // Extract items or convert legacy single-drug fields
      let itemsList = [];
      if (Array.isArray(req.body.items) && req.body.items.length > 0) {
        itemsList = req.body.items.map(it => ({
          medication_name: it.medication_name,
          dosage: it.dosage,
          frequency_key: it.frequency_key || it.frequency || 'prescription.frequency.once_daily',
          duration_days: Math.max(1, Number.parseInt(it.duration_days || (it.duration ? parseInt(it.duration, 10) : 7), 10) || 7),
          instructions: it.instructions || null,
        }));
      } else if (req.body.medication_name) {
        itemsList = [{
          medication_name: req.body.medication_name,
          dosage: req.body.dosage || '1 unit',
          frequency_key: req.body.frequency_key || req.body.frequency || 'prescription.frequency.once_daily',
          duration_days: Math.max(1, Number.parseInt(req.body.duration_days || (req.body.duration ? parseInt(req.body.duration, 10) : 7), 10) || 7),
          instructions: req.body.instructions || null,
        }];
      } else {
        return res.status(400).json({
          error: 'validation.error',
          details: 'Prescription must contain either items array or medication_name'
        });
      }

      const result = await db.transaction().execute(async (trx) => {
        const patient = await trx
          .selectFrom('patients')
          .select('full_name')
          .where('id', '=', patient_id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        if (!patient) {
          const err = new Error('INVALID_PATIENT');
          err.statusCode = 400;
          throw err;
        }

        await sql`SELECT pg_advisory_xact_lock(hashtext(${req.tenantId}))`.execute(trx);

        // Generate prescription number (RX-YYYYMM-NNNN)
        const now = new Date();
        const yearStr = now.getFullYear().toString();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const prefix = 'RX-' + yearStr + monthStr + '-';

        const lastRow = await trx
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

        const createdHeader = await trx
          .insertInto('prescriptions')
          .values({
            tenant_id: req.tenantId,
            patient_id,
            dentist_id: req.user?.id || null,
            prescription_number: prescriptionNumber,
            notes: notes || null,
            status_key: status_key || 'prescription.status.active',
            created_by: req.user?.id || null,
          })
          .returningAll()
          .executeTakeFirst();

        const lineItemsToInsert = itemsList.map(it => ({
          tenant_id: req.tenantId,
          prescription_id: createdHeader.id,
          medication_name: it.medication_name,
          dosage: it.dosage,
          frequency_key: it.frequency_key,
          duration_days: it.duration_days,
          instructions: it.instructions || null
        }));

        const createdItems = await trx
          .insertInto('prescription_items')
          .values(lineItemsToInsert)
          .returningAll()
          .execute();

        return {
          header: createdHeader,
          items: createdItems,
          patientName: patient.full_name
        };
      });

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'prescriptions',
          entityId: result.header.id,
          tenantId: req.tenantId,
          newValues: { ...result.header, items: result.items },
        });
      }

      const legacyFields = result.items.length > 0 ? {
        medication_name: result.items[0].medication_name,
        dosage: result.items[0].dosage,
        frequency: result.items[0].frequency_key,
        duration: String(result.items[0].duration_days),
      } : {};

      res.status(201).json({
        ...result.header,
        ...legacyFields,
        patient_name: result.patientName,
        items: result.items
      });
    } catch (error) {
      if (error.statusCode === 400) {
        return res.status(400).json({ error: 'validation.error', details: 'patient_id is invalid' });
      }
      next(error);
    }
  }
);

// Update prescription header
router.patch('/:id',
  param('id').isUUID(),
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

      const { notes, status_key } = req.body;
      const updateData = {};
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

      const items = await db
        .selectFrom('prescription_items')
        .selectAll()
        .where('prescription_id', '=', item.id)
        .where('tenant_id', '=', req.tenantId)
        .orderBy('created_at', 'asc')
        .execute();

      item.items = items;
      if (items.length > 0) {
        item.medication_name = items[0].medication_name;
        item.dosage = items[0].dosage;
        item.frequency = items[0].frequency_key;
        item.duration = String(items[0].duration_days);
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Delete prescription
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

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
