const express = require('express');
const { param, validationResult } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database');
const { checkUpcomingAppointments } = require('../services/notificationService');

const router = express.Router();

router.use(authenticate);

const MAX_LIMIT = 500;

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, MAX_LIMIT);
    const notifications = await db
      .selectFrom('notifications')
      .selectAll()
      .where('tenant_id', '=', req.tenantId)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    const total = await db
      .selectFrom('notifications')
      .select(db.fn.count('id').as('count'))
      .where('tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    res.json({ data: notifications, total: parseInt(total?.count || '0') });
  } catch (error) {
    next(error);
  }
});

// Mark a notification as read
router.put('/:id/read',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const updated = await db
        .updateTable('notifications')
        .set({ status: 'read' })
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (updated.numUpdatedRows === 0n) {
        return res.status(404).json({ error: 'notification.error.not_found' });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Mark all notifications as read for the tenant
router.put('/read-all', async (req, res, next) => {
  try {
    await db
      .updateTable('notifications')
      .set({ status: 'read' })
      .where('tenant_id', '=', req.tenantId)
      .where('status', '!=', 'read')
      .execute();

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Delete a notification
router.delete('/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const deleted = await db
        .deleteFrom('notifications')
        .where('id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (deleted.numDeletedRows === 0n) {
        return res.status(404).json({ error: 'notification.error.not_found' });
      }

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
);

// Batch delete notifications
router.post('/delete-batch', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'validation.error', details: 'ids must be a non-empty array' });
    }

    await db
      .deleteFrom('notifications')
      .where('id', 'in', ids)
      .where('tenant_id', '=', req.tenantId)
      .execute();

    res.json({ success: true, deleted: ids.length });
  } catch (error) {
    next(error);
  }
});

// Get unread count
router.get('/unread-count', async (req, res, next) => {
  try {
    const result = await db
      .selectFrom('notifications')
      .select(db.fn.count('id').as('count'))
      .where('tenant_id', '=', req.tenantId)
      .where('status', '=', 'unread')
      .executeTakeFirst();

    res.json({ count: parseInt(result?.count || '0') });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
