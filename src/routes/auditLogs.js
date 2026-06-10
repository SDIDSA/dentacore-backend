const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

router.use(authenticate);

// Get audit log IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const pag = parsePagination(req);
    const { 
      entity_type, 
      entity_id, 
      action, 
      user_id, 
      start_date, 
      end_date
    } = req.query;

    let query = db
      .selectFrom('audit_logs')
      .select(['audit_logs.id'])
      .where('audit_logs.tenant_id', '=', req.tenantId);

    if (entity_type) {
      query = query.where('audit_logs.entity_type', '=', entity_type);
    }

    if (entity_id) {
      query = query.where('audit_logs.entity_id', '=', entity_id);
    }

    if (action) {
      query = query.where('audit_logs.action', '=', action);
    }

    if (user_id) {
      query = query.where('audit_logs.user_id', '=', user_id);
    }

    if (start_date) {
      query = query.where('audit_logs.created_at', '>=', start_date);
    }

    if (end_date) {
      query = query.where('audit_logs.created_at', '<=', end_date + ' 23:59:59');
    }

    if (pag.paginate) {
      query = query.select([sql`COUNT(*) OVER()`.as('count')]);
    }

    const auditLogs = await query
      .orderBy('audit_logs.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    const auditLogIds = auditLogs.map(log => log.id);
    if (pag.paginate) {
      const count = auditLogs.length > 0 ? Number(auditLogs[0].count) : 0;
      res.json(wrapPaginatedResponse(auditLogIds, count, pag.limit, pag.offset));
    } else {
      res.json(auditLogIds);
    }
  } catch (error) {
    next(error);
  }
});

// Get audit logs by IDs (batch)
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

    const auditLogs = await db
      .selectFrom('audit_logs')
      .leftJoin('users', 'audit_logs.user_id', 'users.id')
      .select([
        'audit_logs.id',
        'audit_logs.entity_type',
        'audit_logs.entity_id',
        'audit_logs.action',
        'audit_logs.user_id',
        'audit_logs.old_values',
        'audit_logs.new_values',
        'audit_logs.created_at',
        'users.full_name as user_name',
        'users.email as user_email'
      ])
      .where('audit_logs.id', 'in', idArray)
      .where('audit_logs.tenant_id', '=', req.tenantId)
      .execute();

    res.json(auditLogs);
  } catch (error) {
    next(error);
  }
});

// Get audit log by ID with full details
router.get('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const auditLog = await db
        .selectFrom('audit_logs')
        .leftJoin('users', 'audit_logs.user_id', 'users.id')
        .select([
          'audit_logs.id',
          'audit_logs.entity_type',
          'audit_logs.entity_id',
          'audit_logs.action',
          'audit_logs.user_id',
          'audit_logs.old_values',
          'audit_logs.new_values',
          'audit_logs.created_at',
          'users.full_name as user_name',
          'users.email as user_email'
        ])
        .where('audit_logs.id', '=', req.params.id)
        .where('audit_logs.tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!auditLog) {
        return res.status(404).json({ error: 'audit_log.error.not_found' });
      }

      res.json(auditLog);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
