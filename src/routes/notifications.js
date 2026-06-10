const express = require('express');
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

router.post('/remind', async (req, res, next) => {
  try {
    const sent = await checkUpcomingAppointments(req.tenantId);
    res.json({ reminders_sent: sent.length, details: sent });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
