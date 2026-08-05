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

// Search payments
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '');
    const results = await db
      .selectFrom('payments')
      .select('payments.id')
      .where('payments.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('payments.notes', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

const VALID_METHOD_KEYS = [
  'pay.method.cash', 'pay.method.cib', 'pay.method.baridimob',
  'pay.method.edahabia', 'pay.method.bank_transfer', 'pay.method.check',
  'pay.method.satim'
];

async function resolvePaymentMethodId(key) {
  const row = await db
    .selectFrom('payment_methods')
    .select('id')
    .where('method_key', '=', key)
    .executeTakeFirst();
  return row ? row.id : null;
}


// Get payment IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { invoice_id, start_date, end_date, payment_method_key } = req.query;

    // Validate date parameters if provided
    if (start_date && Number.isNaN(Date.parse(start_date))) {
      return res.status(400).json({ error: 'validation.error', details: 'start_date must be a valid ISO date' });
    }
    if (end_date && Number.isNaN(Date.parse(end_date))) {
      return res.status(400).json({ error: 'validation.error', details: 'end_date must be a valid ISO date' });
    }

    let query = db
      .selectFrom('payments')
      .select(['payments.id'])
      .where('payments.tenant_id', '=', req.tenantId);

    if (invoice_id) {
      query = query.where('payments.invoice_id', '=', invoice_id);
    }

    if (start_date) {
      query = query.where('payments.payment_date', '>=', start_date);
    }

    if (end_date) {
      query = query.where('payments.payment_date', '<=', end_date + ' 23:59:59');
    }

    if (payment_method_key) {
      const methodId = await resolvePaymentMethodId(payment_method_key);
      if (methodId) {
        query = query.where('payments.payment_method_id', '=', methodId);
      }
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const payments = await query
      .orderBy('payments.payment_date', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const paymentIds = payments.map(p => p.id);
    if (pag.paginate) {
      const count = payments.length > 0 ? Number(payments[0].count) : 0;
      res.json(wrapPaginatedResponse(paymentIds, count, pag.limit, pag.offset));
    } else {
      res.json(paymentIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get payments by IDs (batch)
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

    const payments = await db
      .selectFrom('payments')
      .leftJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
      .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
      .select([
        'payments.id',
        'payments.invoice_id',
        'payments.amount_dzd',
        'payment_methods.method_key as payment_method_key',
        'payments.payment_date',
        'payments.notes',
        'payments.created_at',
        'invoices.invoice_number'
      ])
      .where('payments.id', 'in', idArray)
      .where('payments.tenant_id', '=', req.tenantId)
      .execute();

    res.json(payments);
  } catch (error) {
    next(error);
  }
});

// Get payment by ID
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let payment = await db
        .selectFrom('payments')
        .leftJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
        .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
        .select([
          'payments.id',
          'payments.invoice_id',
          'payments.amount_dzd',
          'payment_methods.method_key as payment_method_key',
          'payments.payment_date',
          'payments.notes',
          'payments.created_at',
          'invoices.invoice_number'
        ])
        .where('payments.id', '=', req.params.id)
        .where('payments.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!payment) {
        payment = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'payments')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!payment) {
          return res.status(404).json({ error: 'payment.error.not_found' });
        }
      }

      res.json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// Create payment
router.post('/',
  body('amount_dzd').isFloat({ min: 0.01 }),
  body('payment_method_key').isIn(VALID_METHOD_KEYS),
  body('payment_date').isISO8601(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { invoice_id, amount_dzd, payment_method_key, payment_date, notes } = req.body;

      if (!invoice_id) {
        return res.status(400).json({
          error: 'validation.error',
          details: 'invoice_id is required'
        });
      }

      const paymentMethodId = await resolvePaymentMethodId(payment_method_key);
      if (!paymentMethodId) {
        return res.status(400).json({
          error: 'validation.error',
          details: 'Invalid payment method key'
        });
      }

      const payment = await db.transaction().execute(async (trx) => {
        const invoice = await trx
          .selectFrom('invoices')
          .select(['total_dzd', 'paid_amount_dzd'])
          .where('id', '=', invoice_id)
          .where('tenant_id', '=', req.tenantId)
          .forUpdate()
          .executeTakeFirst();

        if (!invoice) {
          const err = new Error('INVOICE_NOT_FOUND');
          err.statusCode = 404;
          err.errorKey = 'payment.error.invoice_not_found';
          throw err;
        }

        const balanceDue = Number(invoice.total_dzd) - Number(invoice.paid_amount_dzd);
        if (amount_dzd > balanceDue) {
          const err = new Error('OVERPAYMENT');
          err.statusCode = 400;
          err.errorKey = 'validation.error';
          err.details = `Payment amount (${amount_dzd}) exceeds remaining balance (${balanceDue})`;
          throw err;
        }

        return await trx
          .insertInto('payments')
          .values({
            invoice_id,
            payment_method_id: paymentMethodId,
            amount_dzd,
            payment_date,
            notes: notes || null,
            received_by: req.user.id,
            tenant_id: req.tenantId
          })
          .returningAll()
          .executeTakeFirst();
      });

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'payments',
          entityId: payment.id,
          tenantId: req.tenantId,
          newValues: payment
        }, db);
      }

      // Return with the key instead of UUID
      const result = {
        ...payment,
        payment_method_key
      };
      delete result.payment_method_id;


      res.status(201).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          error: error.errorKey || 'validation.error',
          details: error.details || error.message
        });
      }
      next(error);
    }
  }
);

// Update payment
router.patch('/:id',
  param('id').isUUID(),
  body('amount_dzd').optional().isFloat({ min: 0.01 }),
  body('payment_method_key').optional().isIn(VALID_METHOD_KEYS),
  body('payment_date').optional().isISO8601(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const currentPayment = await db
        .selectFrom('payments')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentPayment) {
        return res.status(404).json({ error: 'payment.error.not_found' });
      }

      const { amount_dzd, payment_method_key, payment_date, notes } = req.body;

      const updateData = {};
      if (amount_dzd !== undefined) updateData.amount_dzd = amount_dzd;
      if (payment_method_key !== undefined) {
        const methodId = await resolvePaymentMethodId(payment_method_key);
        if (!methodId) {
          return res.status(400).json({ error: 'validation.error', details: 'Invalid payment method key' });
        }
        updateData.payment_method_id = methodId;
      }
      if (payment_date !== undefined) updateData.payment_date = payment_date;
      if (notes !== undefined) updateData.notes = notes;

      const payment = await db
        .updateTable('payments')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'payments',
          entityId: payment.id,
          tenantId: req.tenantId,
          oldValues: currentPayment,
          newValues: payment
        }, db);
      }

      const result = {
        ...payment,
        payment_method_key: payment_method_key || currentPayment.payment_method_key
      };
      delete result.payment_method_id;


      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Delete payment
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const payment = await db
        .selectFrom('payments')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!payment) {
        return res.status(404).json({ error: 'payment.error.not_found' });
      }

      await db
        .deleteFrom('payments')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      payment.status_key = 'payment.status.deleted';

      if (req.audit) {
        await req.audit.log({
          action: 'DELETE',
          entityType: 'payments',
          entityId: req.params.id,
          tenantId: req.tenantId,
          oldValues: payment
        }, db);
      }


      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

