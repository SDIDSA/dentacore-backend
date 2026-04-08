const express = require('express');
const { param, query, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { sql } = require('kysely');
const db = require('../config/database');

const router = express.Router();

router.use(authenticate);

// Get audit log IDs with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { 
      entity_type, 
      entity_id, 
      action, 
      user_id, 
      start_date, 
      end_date, 
      limit = 100,
      offset = 0
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

    const auditLogs = await query
      .orderBy('audit_logs.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .execute();

    const auditLogIds = auditLogs.map(log => log.id);
    res.json(auditLogIds);
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
