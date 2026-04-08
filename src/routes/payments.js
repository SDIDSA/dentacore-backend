const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);

// Get payment IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { patient_id, invoice_id, start_date, end_date, payment_method } = req.query;

    let query = db
      .selectFrom('payments')
      .select(['payments.id'])
      .where('payments.tenant_id', '=', req.tenantId);

    if (patient_id) {
      query = query.where('payments.patient_id', '=', patient_id);
    }

    if (invoice_id) {
      query = query.where('payments.invoice_id', '=', invoice_id);
    }

    if (start_date) {
      query = query.where('payments.payment_date', '>=', start_date);
    }

    if (end_date) {
      query = query.where('payments.payment_date', '<=', end_date + ' 23:59:59');
    }

    if (payment_method) {
      query = query.where('payments.payment_method', '=', payment_method);
    }

    const payments = await query
      .orderBy('payments.payment_date', 'desc')
      .execute();

    const paymentIds = payments.map(p => p.id);
    res.json(paymentIds);
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

      const payment = await db
        .selectFrom('payments')
        .leftJoin('patients', 'payments.patient_id', 'patients.id')
        .leftJoin('invoices', 'payments.invoice_id', 'invoices.id')
        .select([
          'payments.id',
          'payments.patient_id',
          'payments.invoice_id',
          'payments.amount_dzd',
          'payments.payment_method',
          'payments.payment_date',
          'payments.notes',
          'payments.created_at',
          'payments.updated_at',
          'patients.full_name as patient_name',
          'patients.patient_code',
          'invoices.invoice_number'
        ])
        .where('payments.id', '=', req.params.id)
        .where('payments.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!payment) {
        return res.status(404).json({ error: 'payment.error.not_found' });
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
  body('payment_method').isIn(['cash', 'card', 'bank_transfer', 'check']),
  body('payment_date').isISO8601(),
  body('patient_id').optional().isUUID(),
  body('invoice_id').optional().isUUID(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { patient_id, invoice_id, amount_dzd, payment_method, payment_date, notes } = req.body;

      // Validate that either patient_id or invoice_id is provided
      if (!patient_id && !invoice_id) {
        return res.status(400).json({ 
          error: 'validation.error', 
          details: 'Either patient_id or invoice_id must be provided' 
        });
      }

      const payment = await db
        .insertInto('payments')
        .values({
          patient_id: patient_id || null,
          invoice_id: invoice_id || null,
          amount_dzd,
          payment_method,
          payment_date,
          notes: notes || null,
          created_by: req.user.id,
          tenant_id: req.tenantId
        })
        .returningAll()
        .executeTakeFirst();

      // Log the payment creation
      await req.audit.log({
        action: 'CREATE',
        entityType: 'payments',
        entityId: payment.id,
        tenantId: req.tenantId,
        newValues: payment
      }, db);

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// Update payment
router.patch('/:id',
  param('id').isUUID(),
  body('amount_dzd').optional().isFloat({ min: 0.01 }),
  body('payment_method').optional().isIn(['cash', 'card', 'bank_transfer', 'check']),
  body('payment_date').optional().isISO8601(),
  body('patient_id').optional().isUUID(),
  body('invoice_id').optional().isUUID(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      // Get current payment for audit logging
      const currentPayment = await db
        .selectFrom('payments')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!currentPayment) {
        return res.status(404).json({ error: 'payment.error.not_found' });
      }

      const { patient_id, invoice_id, amount_dzd, payment_method, payment_date, notes } = req.body;

      // Build update object with only provided fields
      const updateData = {};
      if (patient_id !== undefined) updateData.patient_id = patient_id;
      if (invoice_id !== undefined) updateData.invoice_id = invoice_id;
      if (amount_dzd !== undefined) updateData.amount_dzd = amount_dzd;
      if (payment_method !== undefined) updateData.payment_method = payment_method;
      if (payment_date !== undefined) updateData.payment_date = payment_date;
      if (notes !== undefined) updateData.notes = notes;
      updateData.updated_at = new Date();

      const payment = await db
        .updateTable('payments')
        .set(updateData)
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Log the payment update
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'payments',
        entityId: payment.id,
        tenantId: req.tenantId,
        oldValues: currentPayment,
        newValues: payment
      }, db);

      res.json(payment);
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

      // Log the deletion
      await req.audit.log({
        action: 'DELETE',
        entityType: 'payments',
        entityId: req.params.id,
        tenantId: req.tenantId,
        oldValues: payment
      }, db);

      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;