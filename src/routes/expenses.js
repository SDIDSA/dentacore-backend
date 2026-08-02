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

// Search expenses
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s\-]/g, '');
    const results = await db
      .selectFrom('expenses')
      .select('expenses.id')
      .where('expenses.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('expenses.description', 'ilike', `%${sanitized}%`),
          eb('expenses.expense_number', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

const VALID_STATUSES = [
  'expense.status.pending', 'expense.status.approved',
  'expense.status.paid', 'expense.status.cancelled'
];

const VALID_FREQUENCIES = ['monthly', 'quarterly', 'yearly'];

async function resolvePaymentMethodId(key) {
  if (!key) return null;
  const row = await db
    .selectFrom('payment_methods')
    .select('id')
    .where('method_key', '=', key)
    .executeTakeFirst();
  return row ? row.id : null;
}

// List expense IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { start_date, end_date, status_key, category_key, supplier_id } = req.query;

    let query = db
      .selectFrom('expenses')
      .select(['expenses.id'])
      .where('expenses.tenant_id', '=', req.tenantId);

    if (start_date) {
      query = query.where('expenses.expense_date', '>=', start_date);
    }
    if (end_date) {
      query = query.where('expenses.expense_date', '<=', end_date + ' 23:59:59');
    }
    if (status_key) {
      query = query.where('expenses.status_key', '=', status_key);
    }
    if (category_key) {
      query = query.where('expenses.category_key', '=', category_key);
    }
    if (supplier_id) {
      query = query.where('expenses.supplier_id', '=', supplier_id);
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const expenses = await query
      .orderBy('expenses.expense_date', 'desc')
      .orderBy('expenses.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const ids = expenses.map(e => e.id);
    if (pag.paginate) {
      const count = expenses.length > 0 ? Number(expenses[0].count) : 0;
      res.json(wrapPaginatedResponse(ids, count, pag.limit, pag.offset));
    } else {
      res.json(ids);
    }
  } catch (error) {
    next(error);
  }
});

// Get expenses by IDs (batch)
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

    const expenses = await db
      .selectFrom('expenses')
      .leftJoin('payment_methods', 'expenses.payment_method_id', 'payment_methods.id')
      .leftJoin('suppliers', 'expenses.supplier_id', 'suppliers.id')
      .leftJoin('users as approver', 'expenses.approved_by', 'approver.id')
      .select([
        'expenses.id',
        'expenses.expense_number',
        'expenses.category_key',
        'expenses.subcategory_key',
        'expenses.description',
        'expenses.amount_dzd',
        'expenses.expense_date',
        'payment_methods.method_key as payment_method_key',
        'expenses.supplier_id',
        'suppliers.name as supplier_name',
        'expenses.receipt_number',
        'expenses.is_recurring',
        'expenses.recurring_frequency',
        'expenses.status_key',
        'expenses.approved_by',
        'approver.full_name as approved_by_name',
        'expenses.approved_at',
        'expenses.paid_at',
        'expenses.notes',
        'expenses.created_at',
        'expenses.updated_at'
      ])
      .where('expenses.id', 'in', idArray)
      .where('expenses.tenant_id', '=', req.tenantId)
      .execute();

    res.json(expenses);
  } catch (error) {
    next(error);
  }
});

// Get expense by ID
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let expense = await db
        .selectFrom('expenses')
        .leftJoin('payment_methods', 'expenses.payment_method_id', 'payment_methods.id')
        .leftJoin('suppliers', 'expenses.supplier_id', 'suppliers.id')
        .leftJoin('users as approver', 'expenses.approved_by', 'approver.id')
        .select([
          'expenses.id',
          'expenses.expense_number',
          'expenses.category_key',
          'expenses.subcategory_key',
          'expenses.description',
          'expenses.amount_dzd',
          'expenses.expense_date',
          'payment_methods.method_key as payment_method_key',
          'expenses.supplier_id',
          'suppliers.name as supplier_name',
          'expenses.receipt_number',
          'expenses.is_recurring',
          'expenses.recurring_frequency',
          'expenses.status_key',
          'expenses.approved_by',
          'approver.full_name as approved_by_name',
          'expenses.approved_at',
          'expenses.paid_at',
          'expenses.notes',
          'expenses.created_at',
          'expenses.updated_at'
        ])
        .where('expenses.id', '=', req.params.id)
        .where('expenses.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!expense) {
        expense = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'expenses')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!expense) {
          return res.status(404).json({ error: 'expense.error.not_found' });
        }
      }

      res.json(expense);
    } catch (error) {
      next(error);
    }
  }
);

// Create expense (expense_number auto-generated by DB trigger)
router.post('/',
  body('category_key').notEmpty().isString(),
  body('description').notEmpty().isString(),
  body('amount_dzd').isFloat({ min: 0.01 }),
  body('expense_date').optional().isISO8601(),
  body('payment_method_key').optional().isString(),
  body('supplier_id').optional().isUUID(),
  body('receipt_number').optional().isString(),
  body('is_recurring').optional().isBoolean(),
  body('recurring_frequency').optional().isIn(VALID_FREQUENCIES),
  body('status_key').optional().isIn(VALID_STATUSES),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        category_key, subcategory_key, description, amount_dzd,
        expense_date, payment_method_key, supplier_id, receipt_number,
        is_recurring, recurring_frequency, status_key, notes
      } = req.body;

      const paymentMethodId = await resolvePaymentMethodId(payment_method_key);

      const expense = await db
        .insertInto('expenses')
        .values({
          category_key,
          subcategory_key: subcategory_key || null,
          description,
          amount_dzd,
          expense_date: expense_date || new Date(),
          payment_method_id: paymentMethodId,
          supplier_id: supplier_id || null,
          receipt_number: receipt_number || null,
          is_recurring: is_recurring || false,
          recurring_frequency: recurring_frequency || null,
          status_key: status_key || 'expense.status.pending',
          notes: notes || null,
          created_by: req.user.id,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'expenses',
          entityId: expense.id,
          tenantId: req.tenantId,
          newValues: expense
        }, db);
      }

      const result = {
        ...expense,
        payment_method_key: payment_method_key || null
      };
      delete result.payment_method_id;

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Update expense
router.patch('/:id',
  param('id').isUUID(),
  body('description').optional().isString(),
  body('amount_dzd').optional().isFloat({ min: 0.01 }),
  body('expense_date').optional().isISO8601(),
  body('payment_method_key').optional().isString(),
  body('supplier_id').optional().isUUID({ allow_null: true }),
  body('receipt_number').optional().isString(),
  body('is_recurring').optional().isBoolean(),
  body('recurring_frequency').optional().isIn(VALID_FREQUENCIES),
  body('status_key').optional().isIn(VALID_STATUSES),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const current = await db
        .selectFrom('expenses')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'expense.error.not_found' });
      }

      if (res.conflictCheck(current)) return;

      const {
        category_key, description, amount_dzd, expense_date,
        payment_method_key, supplier_id, receipt_number,
        is_recurring, recurring_frequency, status_key, notes
      } = req.body;

      const updateData = {};
      if (category_key !== undefined) updateData.category_key = category_key;
      if (description !== undefined) updateData.description = description;
      if (amount_dzd !== undefined) updateData.amount_dzd = amount_dzd;
      if (expense_date !== undefined) updateData.expense_date = expense_date;
      if (payment_method_key !== undefined) {
        updateData.payment_method_id = await resolvePaymentMethodId(payment_method_key);
      }
      if (supplier_id !== undefined) updateData.supplier_id = supplier_id || null;
      if (receipt_number !== undefined) updateData.receipt_number = receipt_number;
      if (is_recurring !== undefined) updateData.is_recurring = is_recurring;
      if (recurring_frequency !== undefined) updateData.recurring_frequency = recurring_frequency || null;
      if (status_key !== undefined) updateData.status_key = status_key;
      if (notes !== undefined) updateData.notes = notes;
      updateData.updated_at = new Date();

      const updated = await db
        .updateTable('expenses')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'expenses',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: current,
          newValues: updated
        }, db);
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Update expense status
router.patch('/:id/status',
  param('id').isUUID(),
  body('status_key').isIn(VALID_STATUSES),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const current = await db
        .selectFrom('expenses')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!current) {
        return res.status(404).json({ error: 'expense.error.not_found' });
      }

      if (res.conflictCheck(current)) return;

      const { status_key } = req.body;
      const updateData = { status_key, updated_at: new Date() };

      if (status_key === 'expense.status.approved') {
        updateData.approved_by = req.user.id;
        updateData.approved_at = new Date();
      } else if (status_key === 'expense.status.paid') {
        updateData.paid_at = new Date();
      }

      const updated = await db
        .updateTable('expenses')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE_STATUS',
          entityType: 'expenses',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: { status_key: current.status_key },
          newValues: { status_key }
        }, db);
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

// Delete expense
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const expense = await db
        .selectFrom('expenses')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!expense) {
        return res.status(404).json({ error: 'expense.error.not_found' });
      }

      await db
        .deleteFrom('expenses')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      expense.status_key = 'expense.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'expenses',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: expense
        }, db);
      }

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
