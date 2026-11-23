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

async function generateCreditNoteNumber(tenantId, trx = db) {
  const now = new Date();
  const yearStr = now.getFullYear().toString();
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `CN-${yearStr}${monthStr}-`;

  const lastNote = await trx
    .selectFrom('credit_notes')
    .select('credit_note_number')
    .where('tenant_id', '=', tenantId)
    .where('credit_note_number', 'like', `${prefix}%`)
    .orderBy('credit_note_number', 'desc')
    .limit(1)
    .executeTakeFirst();

  let seq = 1;
  if (lastNote && lastNote.credit_note_number) {
    const parts = lastNote.credit_note_number.split('-');
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// GET / - List credit notes
router.get('/',
  query('invoice_id').optional().isUUID(),
  query('patient_id').optional().isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const pag = parsePagination(req);
      const { invoice_id, patient_id, ids_only } = req.query;

      let qb = db
        .selectFrom('credit_notes')
        .selectAll()
        .where('tenant_id', '=', req.tenantId);

      if (invoice_id) {
        qb = qb.where('invoice_id', '=', invoice_id);
      }
      if (patient_id) {
        qb = qb.where('patient_id', '=', patient_id);
      }

      if (pag.paginate) {
        qb = qb.select(sql`COUNT(*) OVER()`.as('total_count'));
      }

      const results = await qb
        .orderBy('created_at', 'desc')
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

// GET /batch - Get credit notes by IDs
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

      const notes = await db
        .selectFrom('credit_notes')
        .selectAll()
        .where('id', 'in', idArray)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      res.json(notes);
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get single credit note
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const note = await db
        .selectFrom('credit_notes')
        .selectAll()
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!note) {
        return res.status(404).json({ error: 'credit_note.error.not_found', message: 'Credit note not found' });
      }

      res.json(note);
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Create credit note
router.post('/',
  body('invoice_id').isUUID(),
  body('amount_dzd').isFloat({ min: 0.01 }),
  body('reason').trim().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const { invoice_id, amount_dzd, reason } = req.body;

      const invoice = await db
        .selectFrom('invoices')
        .selectAll()
        .where('id', '=', invoice_id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!invoice) {
        return res.status(404).json({ error: 'invoice.error.not_found', message: 'Invoice not found' });
      }

      const amount = Number(amount_dzd);
      const paidAmount = Number(invoice.paid_amount_dzd);
      if (amount > paidAmount) {
        return res.status(400).json({
          error: 'credit_note.error.exceeds_paid_amount',
          message: `Credit note amount (${amount}) exceeds invoice paid amount (${paidAmount})`
        });
      }

      const creditNoteNumber = await generateCreditNoteNumber(req.tenantId);

      const created = await db
        .insertInto('credit_notes')
        .values({
          tenant_id: req.tenantId,
          credit_note_number: creditNoteNumber,
          invoice_id: invoice.id,
          patient_id: invoice.patient_id,
          amount_dzd: amount,
          reason,
          issued_by: req.userId || req.user?.id || null,
          created_at: sql`NOW()`
        })
        .returningAll()
        .executeTakeFirst();

      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'credit_notes',
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

module.exports = router;
