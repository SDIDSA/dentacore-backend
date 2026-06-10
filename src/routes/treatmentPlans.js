const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { sql } = require('kysely');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);

const SORT_FIELDS = ['created_at', 'plan_name', 'estimated_total_dzd', 'status_key', 'updated_at'];
const SORT_ORDERS = ['asc', 'desc'];

// Get treatment plans with pagination, search, and sort
router.get('/',
  query('patient_id').optional().isUUID(),
  query('search').optional().isString(),
  query('sort_by').optional().isIn(SORT_FIELDS),
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

      const sortField = sort_by && SORT_FIELDS.includes(sort_by) ? sort_by : 'created_at';
      const sortDir = sort_order && SORT_ORDERS.includes(sort_order) ? sort_order : 'desc';

      const plans = await query
        .selectAll()
        .orderBy(`treatment_plans.${sortField}`, sortDir)
        .limit(pag.paginate ? pag.limit : null)
        .offset(pag.paginate ? pag.offset : null)
        .execute();

      const plansWithCosts = await Promise.all(plans.map(async (plan) => {
        const costResult = await db
          .selectFrom('treatment_records')
          .select(db.fn.sum('estimated_cost_dzd').as('actual_total'))
          .where('plan_id', '=', plan.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        const treatmentCount = await db
          .selectFrom('treatment_records')
          .select(db.fn.count('id').as('count'))
          .where('plan_id', '=', plan.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        return {
          ...plan,
          actual_total_dzd: costResult?.actual_total || 0,
          treatment_count: parseInt(treatmentCount?.count || '0'),
        };
      }));

      if (pag.paginate) {
        const total = plans.length > 0 ? Number(plans[0].count) : 0;
        res.json(wrapPaginatedResponse(plansWithCosts, total, pag.limit, pag.offset));
      } else {
        res.json(plansWithCosts);
      }
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

      const { plan_name, description, status_key, estimated_total_dzd } = req.body;
      const updateData = { updated_at: new Date() };
      if (plan_name !== undefined) updateData.plan_name = plan_name;
      if (description !== undefined) updateData.description = description;
      if (status_key !== undefined) updateData.status_key = status_key;
      if (estimated_total_dzd !== undefined) updateData.estimated_total_dzd = estimated_total_dzd;

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
