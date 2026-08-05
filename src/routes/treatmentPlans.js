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
  created_at: 'treatment_plans.created_at',
  plan_name: 'treatment_plans.plan_name',
  estimated_total_dzd: 'treatment_plans.estimated_total_dzd',
  status_key: 'treatment_plans.status_key',
  updated_at: 'treatment_plans.updated_at',
};
const SORT_ORDERS = ['asc', 'desc'];

// Search treatment plans
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '');
    const results = await db
      .selectFrom('treatment_plans')
      .select('treatment_plans.id')
      .innerJoin('patients', 'treatment_plans.patient_id', 'patients.id')
      .where('treatment_plans.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('treatment_plans.plan_name', 'ilike', `%${sanitized}%`),
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

// Get treatment plans with pagination, search, and sort
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
        .selectFrom('treatment_plans')
        .where('treatment_plans.tenant_id', '=', req.tenantId);

      if (patient_id) {
        query = query.where('treatment_plans.patient_id', '=', patient_id);
      }

      if (search) {
        query = query.where('treatment_plans.plan_name', 'ilike', `%${search}%`);
      }

      if (pag.paginate) {
        query = query.select([sql`COUNT(*) OVER()`.as('count')]);
      }

      const sortField = sort_by && SORT_FIELDS_MAP[sort_by] ? SORT_FIELDS_MAP[sort_by] : 'treatment_plans.created_at';
      const sortDir = sort_order && SORT_ORDERS.includes(sort_order) ? sort_order : 'desc';

      const plans = await query
        .select(['treatment_plans.id'])
        .orderBy(sortField, sortDir)
        .limit(pag.paginate ? pag.limit : null)
        .offset(pag.paginate ? pag.offset : null)
        .execute();

      const planIds = plans.map(p => p.id);
      if (pag.paginate) {
        const total = plans.length > 0 ? Number(plans[0].count) : 0;
        res.json(wrapPaginatedResponse(planIds, total, pag.limit, pag.offset));
      } else {
        res.json(planIds);
      }
    } catch (error) {
      next(error);
    }
  }
);

// Get treatment plans by IDs (batch)
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

      const plans = await db
        .selectFrom('treatment_plans')
        .selectAll()
        .where('treatment_plans.id', 'in', idArray)
        .where('treatment_plans.tenant_id', '=', req.tenantId)
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

      const plansWithCosts = plans.map(plan => ({
        ...plan,
        actual_total_dzd: aggMap[plan.id]?.actual_total || 0,
        treatment_count: Number.parseInt(aggMap[plan.id]?.treatment_count || '0'),
      }));

      res.json(plansWithCosts);
    } catch (error) {
      next(error);
    }
  }
);

// Get single treatment plan with its treatments
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const plan = await db
        .selectFrom('treatment_plans')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!plan) {
        return res.status(404).json({ error: 'plan.error.not_found' });
      }

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
        .where('treatment_records.plan_id', '=', req.params.id)
        .where('treatment_records.tenant_id', '=', req.tenantId)
        .execute();

      res.json({ ...plan, treatments });
    } catch (error) {
      next(error);
    }
  }
);

// Create treatment plan
router.post('/',
  body('patient_id').isUUID(),
  body('plan_name').trim().notEmpty(),
  body('description').optional().isString(),
  body('estimated_total_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, plan_name, description, estimated_total_dzd } = req.body;

      const plan = await db
        .insertInto('treatment_plans')
        .values({
          tenant_id: req.tenantId,
          patient_id,
          plan_name,
          description: description || null,
          estimated_total_dzd: estimated_total_dzd || 0,
          created_by: req.user.id,
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'treatment_plans',
          entityId: plan.id,
          tenantId: req.tenantId,
          newValues: plan,
        });
      }

      res.status(201).json({ ...plan, treatments: [], actual_total_dzd: 0, treatment_count: 0 });
    } catch (error) {
      next(error);
    }
  }
);

// Update treatment plan
router.patch('/:id',
  param('id').isUUID(),
  body('plan_name').optional().trim().notEmpty(),
  body('description').optional().isString(),
  body('status_key').optional().isIn([
    'plan.status.draft', 'plan.status.active',
    'plan.status.completed', 'plan.status.cancelled'
  ]),
  body('estimated_total_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const current = await db
        .selectFrom('treatment_plans')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'plan.error.not_found' });
      }

      if (res.conflictCheck(current)) return;

      const { plan_name, description, status_key, estimated_total_dzd } = req.body;
      const updateData = {};
      if (plan_name !== undefined) updateData.plan_name = plan_name;
      if (description !== undefined) updateData.description = description;
      if (status_key !== undefined) updateData.status_key = status_key;
      if (estimated_total_dzd !== undefined) updateData.estimated_total_dzd = estimated_total_dzd;

      if (Object.keys(updateData).length === 0) {
        return res.json(current);
      }
      updateData.updated_at = new Date();

      const plan = await db
        .updateTable('treatment_plans')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'treatment_plans',
          entityId: plan.id,
          tenantId: req.tenantId,
          oldValues: current,
          newValues: plan,
        });
      }

      res.json(plan);
    } catch (error) {
      next(error);
    }
  }
);

// Delete treatment plan
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const plan = await db
        .selectFrom('treatment_plans')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!plan) {
        return res.status(404).json({ error: 'plan.error.not_found' });
      }

      await db
        .deleteFrom('treatment_plans')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      plan.status_key = 'plan.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'treatment_plans',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: plan,
        });
      }

      res.json(plan);
    } catch (error) {
      next(error);
    }
  }
);

// Add treatment record to a plan
router.post('/:id/treatments',
  param('id').isUUID(),
  body('treatment_id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const plan = await db
        .selectFrom('treatment_plans')
        .select('id')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!plan) {
        return res.status(404).json({ error: 'plan.error.not_found' });
      }

      const updated = await db
        .updateTable('treatment_records')
        .set({ plan_id: req.params.id, updated_at: new Date() })
        .where('id', '=', req.body.treatment_id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return res.status(404).json({ error: 'treatment.error.not_found' });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Remove treatment record from a plan
router.delete('/:id/treatments/:treatmentId',
  param('id').isUUID(),
  param('treatmentId').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const updated = await db
        .updateTable('treatment_records')
        .set({ plan_id: null, updated_at: new Date() })
        .where('id', '=', req.params.treatmentId)
        .where('tenant_id', '=', req.tenantId)
        .where('plan_id', '=', req.params.id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return res.status(404).json({ error: 'treatment.error.not_found' });
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
