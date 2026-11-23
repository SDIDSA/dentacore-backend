const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);
router.use(conflictResolution);

// GET /active - Get currently open session
router.get('/active', async (req, res, next) => {
  try {
    const session = await db
      .selectFrom('cash_register_sessions')
      .selectAll()
      .where('tenant_id', '=', req.tenantId)
      .where('status', '=', 'OPEN')
      .executeTakeFirst();

    if (!session) {
      if (req.query.allow_null === 'true') {
        return res.json(null);
      }
      return res.status(404).json({ error: 'cash_session.none_active', message: 'No active cash register session' });
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

// GET / - List sessions
router.get('/',
  query('status').optional().isIn(['OPEN', 'CLOSED']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const pag = parsePagination(req);
      const { status, ids_only } = req.query;

      let qb = db
        .selectFrom('cash_register_sessions')
        .selectAll()
        .where('tenant_id', '=', req.tenantId);

      if (status) {
        qb = qb.where('status', '=', status);
      }

      if (pag.paginate) {
        qb = qb.select(sql`COUNT(*) OVER()`.as('total_count'));
      }

      const results = await qb
        .orderBy('opened_at', 'desc')
        .limit(pag.paginate ? pag.limit : null)
        .offset(pag.paginate ? pag.offset : null)
        .execute();

      if (pag.paginate) {
        const count = results.length > 0 ? Number(results[0].total_count) : 0;
        const cleanResults = results.map(r => {
          const { total_count: _, ...rest } = r;
          return ids_only === 'true' ? rest.id : rest;
        });
        return res.json(wrapPaginatedResponse(cleanResults, count, pag.limit, pag.offset));
      }

      if (ids_only === 'true') {
        return res.json(results.map(r => r.id));
      }

      res.json(results);
    } catch (error) {
      next(error);
    }
  }
);

// GET /batch - Get sessions by IDs
router.get('/batch',
  query('ids').isString(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const { ids } = req.query;
      const idArray = ids.split(',').map(id => id.trim()).filter(id => id.length > 0);
      if (idArray.length === 0) {
        return res.json([]);
      }

      const sessions = await db
        .selectFrom('cash_register_sessions')
        .selectAll()
        .where('id', 'in', idArray)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      res.json(sessions);
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get single session
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const session = await db
        .selectFrom('cash_register_sessions')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!session) {
        return res.status(404).json({ error: 'cash_session.not_found', message: 'Cash register session not found' });
      }

      res.json(session);
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Open cash register session
router.post('/',
  body('opening_float_dzd').optional().isFloat({ min: 0 }),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { opening_float_dzd = 0, notes } = req.body;

      const activeSession = await db
        .selectFrom('cash_register_sessions')
        .selectAll()
        .where('tenant_id', '=', req.tenantId)
        .where('status', '=', 'OPEN')
        .executeTakeFirst();

      if (activeSession) {
        return res.status(400).json({
          error: 'cash_session.already_open',
          message: 'An active cash register session is already open'
        });
      }

      const created = await db
        .insertInto('cash_register_sessions')
        .values({
          tenant_id: req.tenantId,
          opened_by: req.userId || req.user?.id,
          opened_at: sql`NOW()`,
          opening_float_dzd: Number(opening_float_dzd),
          status: 'OPEN',
          notes: notes || null
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'cash_register_sessions',
          entityId: created.id,
          tenantId: req.tenantId,
          newValues: created
        }, db);
      }

      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  }
);

// POST /:id/close - Close cash register session
router.post('/:id/close',
  param('id').isUUID(),
  body('counted_cash_dzd').isFloat({ min: 0 }),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { counted_cash_dzd, notes } = req.body;

      const session = await db
        .selectFrom('cash_register_sessions')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!session) {
        return res.status(404).json({ error: 'cash_session.not_found', message: 'Cash register session not found' });
      }

      if (session.status !== 'OPEN') {
        return res.status(400).json({ error: 'cash_session.already_closed', message: 'Session is already closed' });
      }

      // Lookup cash payment method ID
      const cashMethod = await db
        .selectFrom('payment_methods')
        .select('id')
        .where('method_key', '=', 'pay.method.cash')
        .executeTakeFirst();
      const cashMethodId = cashMethod?.id;

      // Calculate cash payments within this session
      const paymentsResult = await db
        .selectFrom('payments')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('tenant_id', '=', req.tenantId)
        .where((eb) => {
          const conds = [eb('cash_session_id', '=', session.id)];
          if (cashMethodId) {
            conds.push(
              eb.and([
                eb('payment_method_id', '=', cashMethodId),
                eb('payment_date', '>=', session.opened_at)
              ])
            );
          }
          return eb.or(conds);
        })
        .executeTakeFirst();

      const cashPaymentsTotal = Number(paymentsResult?.total ?? 0);

      // Calculate cash expenses within this session
      const expensesResult = await db
        .selectFrom('expenses')
        .select(sql`COALESCE(SUM(amount_dzd), 0)`.as('total'))
        .where('tenant_id', '=', req.tenantId)
        .where((eb) => {
          const conds = [eb('cash_session_id', '=', session.id)];
          if (cashMethodId) {
            conds.push(
              eb.and([
                eb('payment_method_id', '=', cashMethodId),
                eb('expense_date', '>=', session.opened_at)
              ])
            );
          }
          return eb.or(conds);
        })
        .executeTakeFirst();

      const cashExpensesTotal = Number(expensesResult?.total ?? 0);

      const openingFloat = Number(session.opening_float_dzd ?? 0);
      const expected_cash_dzd = openingFloat + cashPaymentsTotal - cashExpensesTotal;
      const counted = Number(counted_cash_dzd);
      const discrepancy_dzd = counted - expected_cash_dzd;

      const updated = await db
        .updateTable('cash_register_sessions')
        .set({
          closed_by: req.userId || req.user?.id || null,
          closed_at: sql`NOW()`,
          counted_cash_dzd: counted,
          expected_cash_dzd,
          discrepancy_dzd,
          status: 'CLOSED',
          notes: notes !== undefined ? notes : session.notes
        })
        .where('id', '=', session.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'cash_register_sessions',
          entityId: updated.id,
          tenantId: req.tenantId,
          oldValues: session,
          newValues: updated
        }, db);
      }

      res.json(updated);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
