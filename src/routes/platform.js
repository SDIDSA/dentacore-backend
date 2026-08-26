// Platform administration surface — the Sera operator's cross-tenant API.
// Guarded router-wide by auth.role.platform_admin (a role no clinic account
// holds); every query here intentionally ignores the tenant discriminator.
// Mounted at /api/v1/platform with mutationLimiter in app.js.
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('auth.role.platform_admin'));

const SUBSCRIPTION_STATUSES = [
  'tenant.status.trial', 'tenant.status.active', 'tenant.status.suspended',
  'tenant.status.cancelled', 'tenant.status.expired',
];

const TENANT_SORT_STATUSES = ['active', 'trial', 'suspended', 'cancelled', 'expired'];

const error = (res, code, err) => res.status(code).json({ error: err });

// per-tenant usage counts, computed in one pass via correlated subselects
const countSelect = [
  (eb) =>
    eb.selectFrom('users').select((e) => e.fn.countAll().as('c')).whereRef('users.tenant_id', '=', 'tenants.id').as('user_count'),
  (eb) =>
    eb.selectFrom('patients').select((e) => e.fn.countAll().as('c')).whereRef('patients.tenant_id', '=', 'tenants.id').as('patient_count'),
  (eb) =>
    eb.selectFrom('appointments').select((e) => e.fn.countAll().as('c')).whereRef('appointments.tenant_id', '=', 'tenants.id').as('appointment_count'),
];

const tenantColumns = [
  'tenants.id', 'tenants.name', 'tenants.subdomain', 'tenants.subscription_status',
  'tenants.subscription_plan', 'tenants.subscription_started_at', 'tenants.subscription_ends_at',
  'tenants.is_active', 'tenants.created_at',
];

// GET /stats — platform-wide totals
router.get('/stats', async (req, res, next) => {
  try {
    const [tenants] = await db.selectFrom('tenants').select([
      (eb) => eb.fn.countAll().as('total'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.active').as('active'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.trial').as('trial'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.suspended').as('suspended'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('tenants.created_at', '>=', new Date(Date.now() - 30 * 86400000)).as('signups_30d'),
    ]).execute();

    const [users] = await db.selectFrom('users').select(e => e.fn.countAll().as('total')).execute();
    const [patients] = await db.selectFrom('patients').select(e => e.fn.countAll().as('total')).execute();
    const [appointments] = await db.selectFrom('appointments').select(e => e.fn.countAll().as('total')).execute();

    return res.json({
      tenants: {
        total: Number(tenants.total),
        active: Number(tenants.active),
        trial: Number(tenants.trial),
        suspended: Number(tenants.suspended),
        signups_30d: Number(tenants.signups_30d),
      },
      users: Number(users.total),
      patients: Number(patients.total),
      appointments: Number(appointments.total),
    });
  } catch (e) { next(e); }
});

// GET /tenants?search=&status=&page=1&limit=20
router.get('/tenants',
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('status').optional().isIn(TENANT_SORT_STATUSES),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const search = (req.query.search || '').trim();
      const status = req.query.status;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      let q = db.selectFrom('tenants').select([...tenantColumns, ...countSelect]);
      let cq = db.selectFrom('tenants').select(e => e.fn.countAll().as('total'));

      if (search) {
        const like = `%${search.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
        q = q.where((eb) => eb.or([
          eb('tenants.name', 'ilike', like),
          eb('tenants.subdomain', 'ilike', like),
        ]));
        cq = cq.where((eb) => eb.or([
          eb('tenants.name', 'ilike', like),
          eb('tenants.subdomain', 'ilike', like),
        ]));
      }
      if (status) {
        q = q.where('tenants.subscription_status', '=', `tenant.status.${status}`);
        cq = cq.where('tenants.subscription_status', '=', `tenant.status.${status}`);
      }

      const [rows, [count]] = await Promise.all([
        q.orderBy('tenants.created_at', 'desc').limit(limit).offset((page - 1) * limit).execute(),
        cq.execute(),
      ]);

      return res.json({
        tenants: rows.map((t) => ({
          ...t,
          user_count: Number(t.user_count),
          patient_count: Number(t.patient_count),
          appointment_count: Number(t.appointment_count),
        })),
        total: Number(count.total),
        page,
        limit,
      });
    } catch (e) { next(e); }
  }
);

// GET /tenants/:id — detail + users
router.get('/tenants/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const [tenant] = await db.selectFrom('tenants')
        .select([...tenantColumns, ...countSelect])
        .where('tenants.id', '=', req.params.id)
        .execute();
      if (!tenant) {
        return error(res, 404, 'platform.error.tenant_not_found');
      }

      const users = await db.selectFrom('users')
        .innerJoin('roles', 'users.role_id', 'roles.id')
        .select([
          'users.id', 'users.email', 'users.full_name', 'users.status_key',
          'users.last_login_at', 'users.created_at', 'roles.role_key',
        ])
        .where('users.tenant_id', '=', req.params.id)
        .orderBy('users.created_at', 'asc')
        .execute();

      return res.json({
        tenant: {
          ...tenant,
          user_count: Number(tenant.user_count),
          patient_count: Number(tenant.patient_count),
          appointment_count: Number(tenant.appointment_count),
        },
        users,
      });
    } catch (e) { next(e); }
  }
);

// PATCH /tenants/:id — subscription + lifecycle management
router.patch('/tenants/:id',
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('subscription_status').optional().isIn(SUBSCRIPTION_STATUSES),
  body('subscription_plan').optional().isString().trim().isLength({ max: 50 }),
  body('subscription_ends_at').optional({ nullable: true }).isISO8601(),
  body('is_active').optional().isBoolean(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const updates = {};
      for (const field of ['name', 'subscription_status', 'subscription_plan', 'subscription_ends_at', 'is_active']) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      if (Object.keys(updates).length === 0) {
        return error(res, 400, 'validation.error');
      }
      updates.updated_at = new Date();

      const tenant = await db.selectFrom('tenants')
        .selectAll()
        .where('id', '=', req.params.id)
        .executeTakeFirst();
      if (!tenant) {
        return error(res, 404, 'platform.error.tenant_not_found');
      }

      const [updated] = await db.updateTable('tenants')
        .set(updates)
        .where('id', '=', req.params.id)
        .returningAll()
        .execute();

      logger.info('platform tenant update', {
        tenant: updated.subdomain, fields: Object.keys(updates), by: req.user.email,
      });

      return res.json({ tenant: updated });
    } catch (e) { next(e); }
  }
);

module.exports = router;
