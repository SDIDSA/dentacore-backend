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

// Get invoice IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { patient_id, start_date, end_date, status } = req.query;

    let query = db
      .selectFrom('invoices')
      .select(['invoices.id'])
      .where('invoices.tenant_id', '=', req.tenantId);

    if (patient_id) {
      query = query.where('invoices.patient_id', '=', patient_id);
    }

    if (start_date) {
      query = query.where('invoices.issue_date', '>=', start_date);
    }

    if (end_date) {
      query = query.where('invoices.issue_date', '<=', end_date + ' 23:59:59');
    }

    if (status) {
      query = query.where('invoices.payment_status_key', '=', status);
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const invoices = await query
      .orderBy('invoices.issue_date', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const invoiceIds = invoices.map(i => i.id);
    if (pag.paginate) {
      const count = invoices.length > 0 ? Number(invoices[0].count) : 0;
      res.json(wrapPaginatedResponse(invoiceIds, count, pag.limit, pag.offset));
    } else {
      res.json(invoiceIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get invoices by IDs (batch)
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

    const invoices = await db
      .selectFrom('invoices')
      .innerJoin('patients', 'invoices.patient_id', 'patients.id')
      .select([
        'invoices.id',
        'invoices.invoice_number',
        'invoices.patient_id',
        'invoices.issue_date',
        'invoices.due_date',
        'invoices.subtotal_dzd',
        'invoices.discount_dzd',
        'invoices.tax_dzd',
        'invoices.total_dzd',
        'invoices.paid_amount_dzd',
        'invoices.payment_status_key',
        'invoices.notes',
        'invoices.created_at',
        'invoices.updated_at',
        'patients.full_name as patient_name',
        'patients.patient_code',
        'patients.phone as patient_phone',
        'patients.email as patient_email',
        sql`invoices.total_dzd - invoices.paid_amount_dzd`.as('balance_dzd')
      ])
      .where('invoices.id', 'in', idArray)
      .where('invoices.tenant_id', '=', req.tenantId)
      .execute();

    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

// Get invoice by ID with line items
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      let invoice = await db
        .selectFrom('invoices')
        .innerJoin('patients', 'invoices.patient_id', 'patients.id')
        .select([
          'invoices.id',
          'invoices.invoice_number',
          'invoices.patient_id',
          'invoices.issue_date',
          'invoices.due_date',
          'invoices.subtotal_dzd',
          'invoices.discount_dzd',
          'invoices.tax_dzd',
          'invoices.total_dzd',
          'invoices.paid_amount_dzd',
          'invoices.payment_status_key',
          'invoices.notes',
          'invoices.created_at',
          'invoices.updated_at',
          'patients.full_name as patient_name',
          'patients.patient_code',
          'patients.phone as patient_phone',
          'patients.email as patient_email',
          sql`invoices.total_dzd - invoices.paid_amount_dzd`.as('balance_dzd')
        ])
        .where('invoices.id', '=', req.params.id)
        .where('invoices.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!invoice) {
        invoice = (await db
          .selectFrom('audit_logs')
          .select('old_values')
          .where('entity_type', '=', 'invoices')
          .where('action', '=', 'DELETE')
          .where('entity_id', '=', req.params.id)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst())?.old_values;

        if (!invoice) {
          return res.status(404).json({ error: 'invoice.error.not_found' });
        }
      }

      // Get invoice line items
      const lineItems = await db
        .selectFrom('invoice_items')
        .select([
          'id',
          'description',
          'quantity',
          'unit_price_dzd',
          'total_price_dzd',
          'treatment_record_id'
        ])
        .where('invoice_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .orderBy('created_at', 'asc')
        .execute();

      // Get related payments
      const payments = await db
        .selectFrom('payments')
        .innerJoin('payment_methods', 'payments.payment_method_id', 'payment_methods.id')
        .select([
          'payments.id',
          'payments.amount_dzd',
          'payment_methods.method_key as payment_method',
          'payments.payment_date',
          'payments.notes'
        ])
        .where('payments.invoice_id', '=', req.params.id)
        .where('payments.tenant_id', '=', req.tenantId)
        .orderBy('payments.payment_date', 'desc')
        .execute();

      res.json({
        ...invoice,
        line_items: lineItems,
        payments
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create invoice
router.post('/',
  body('patient_id').isUUID(),
  body('issue_date').isISO8601(),
  body('due_date').optional().isISO8601(),
  body('line_items').isArray({ min: 1 }),
  body('line_items.*.description').notEmpty(),
  body('line_items.*.quantity').isInt({ min: 1 }),
  body('line_items.*.unit_price_dzd').isFloat({ min: 0 }),
  body('line_items.*.treatment_record_id').optional().isUUID(),
  body('discount_dzd').optional().isFloat({ min: 0 }),
  body('tax_dzd').optional().isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, issue_date, due_date, line_items, notes, discount_dzd = 0, tax_dzd = 0 } = req.body;

      // Calculate subtotal
      const subtotal_dzd = line_items.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_price_dzd);
      }, 0);

      // Calculate total
      const total_dzd = subtotal_dzd - discount_dzd + tax_dzd;

      // Create invoice
      const invoice = await db
        .insertInto('invoices')
        .values({
          patient_id,
          issue_date,
          due_date: due_date || null,
          subtotal_dzd,
          discount_dzd,
          tax_dzd,
          total_dzd,
          paid_amount_dzd: 0,
          payment_status_key: 'invoice.status.unpaid',
          notes: notes || null,
          created_by: req.user.id,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      // Create line items
      const lineItemsWithInvoiceId = line_items.map(item => ({
        tenant_id: req.tenantId,
        invoice_id: invoice.id,
        treatment_record_id: item.treatment_record_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price_dzd: item.unit_price_dzd,
        total_price_dzd: item.quantity * item.unit_price_dzd
      }));

      await db
        .insertInto('invoice_items')
        .values(lineItemsWithInvoiceId)
        .execute();

      // Log the invoice creation
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'invoices',
          entityId: invoice.id,
          tenantId: req.tenantId,
          newValues: { ...invoice, line_items: lineItemsWithInvoiceId }
        }, db);
      }

      res.status(201).json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update invoice status
router.patch('/:id/status',
  param('id').isUUID(),
  body('payment_status_key').isIn(['invoice.status.unpaid', 'invoice.status.partial', 'invoice.status.paid', 'invoice.status.overdue', 'invoice.status.cancelled']),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { payment_status_key } = req.body;

      // Get current invoice for audit logging
      const currentInvoice = await db
        .selectFrom('invoices')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentInvoice) {
        return res.status(404).json({ error: 'invoice.error.not_found' });
      }

      if (res.conflictCheck(currentInvoice)) return;

      const invoice = await db
        .updateTable('invoices')
        .set({
          payment_status_key,
          updated_at: new Date()
        })
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the status update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'invoices',
          entityId: invoice.id,
          tenantId: req.tenantId,
          oldValues: { payment_status_key: currentInvoice.payment_status_key },
          newValues: { payment_status_key: invoice.payment_status_key }
        }, db);
      }

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update paid amount (when payments are made)
router.patch('/:id/payment',
  param('id').isUUID(),
  body('paid_amount_dzd').isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { paid_amount_dzd } = req.body;

      // Get current invoice
      const currentInvoice = await db
        .selectFrom('invoices')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentInvoice) {
        return res.status(404).json({ error: 'invoice.error.not_found' });
      }

      if (res.conflictCheck(currentInvoice)) return;

      // Determine new status based on payment
      let newStatus = currentInvoice.payment_status_key;
      if (paid_amount_dzd >= currentInvoice.total_dzd) {
        newStatus = 'invoice.status.paid';
      } else if (paid_amount_dzd > 0) {
        newStatus = 'invoice.status.partial';
      } else {
        newStatus = 'invoice.status.unpaid';
      }

      const invoice = await db
        .updateTable('invoices')
        .set({
          paid_amount_dzd,
          payment_status_key: newStatus,
          updated_at: new Date()
        })
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the payment update
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'invoices',
          entityId: invoice.id,
          tenantId: req.tenantId,
          oldValues: { 
            paid_amount_dzd: currentInvoice.paid_amount_dzd,
            payment_status_key: currentInvoice.payment_status_key 
          },
          newValues: { 
            paid_amount_dzd: invoice.paid_amount_dzd,
            payment_status_key: invoice.payment_status_key 
          }
        }, db);
      }

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

// Update invoice (full update - for mutation replay)
router.put('/:id',
  param('id').isUUID(),
  body('patient_id').optional().isUUID(),
  body('issue_date').optional().isISO8601(),
  body('due_date').optional({ values: 'null' }).isISO8601(),
  body('discount_dzd').optional().isFloat({ min: 0 }),
  body('tax_dzd').optional().isFloat({ min: 0 }),
  body('paid_amount_dzd').optional().isFloat({ min: 0 }),
  body('payment_status_key').optional().isString(),
  body('notes').optional().isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const currentInvoice = await db
        .selectFrom('invoices')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentInvoice) {
        return res.status(404).json({ error: 'invoice.error.not_found' });
      }

      if (res.conflictCheck(currentInvoice)) return;

      const { patient_id, issue_date, due_date, discount_dzd, tax_dzd, paid_amount_dzd, payment_status_key, notes } = req.body;

      const updateData = {};
      if (patient_id !== undefined) updateData.patient_id = patient_id;
      if (issue_date !== undefined) updateData.issue_date = issue_date;
      if (due_date !== undefined) updateData.due_date = due_date;
      if (discount_dzd !== undefined) updateData.discount_dzd = discount_dzd;
      if (tax_dzd !== undefined) updateData.tax_dzd = tax_dzd;

      if (paid_amount_dzd !== undefined) {
        updateData.paid_amount_dzd = paid_amount_dzd;
        let newStatus = 'invoice.status.unpaid';
        if (paid_amount_dzd >= currentInvoice.total_dzd) {
          newStatus = 'invoice.status.paid';
        } else if (paid_amount_dzd > 0) {
          newStatus = 'invoice.status.partial';
        }
        updateData.payment_status_key = newStatus;
      }

      if (payment_status_key !== undefined && paid_amount_dzd === undefined) {
        updateData.payment_status_key = payment_status_key;
      }

      if (notes !== undefined) updateData.notes = notes;
      updateData.updated_at = new Date();

      const invoice = await db
        .updateTable('invoices')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'invoices',
          entityId: invoice.id,
          tenantId: req.tenantId,
          oldValues: currentInvoice,
          newValues: invoice
        }, db);
      }

      res.json(invoice);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;