// Platform administration surface — the Sera operator's cross-tenant API.
// Guarded router-wide by auth.role.platform_admin (a role no clinic account
// holds); every query here intentionally ignores the tenant discriminator.
// Mounted at /api/v1/platform with mutationLimiter in app.js.
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { sql } = require('kysely');
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

// --- helpers ---------------------------------------------------------------

function auditLog(operator, action, tenantId, tenantName, details, ip) {
  return db.insertInto('platform_audit_log').values({
    operator_id: operator.id,
    operator_email: operator.email,
    action,
    target_tenant_id: tenantId || null,
    target_tenant_name: tenantName || null,
    details: details || {},
    ip_address: ip || null,
  }).execute().catch(() => {});
}

function nextInvoiceNumber() {
  return db.selectFrom('platform_invoices')
    .select(e => [e.fn.max('invoice_number').as('last')])
    .executeTakeFirst()
    .then((row) => {
      const last = row?.last || 'PLF-000000';
      const num = parseInt(last.replace('PLF-', ''), 10) + 1;
      return 'PLF-' + String(num).padStart(6, '0');
    });
}

// per-tenant usage counts
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
  'tenants.plan_id', 'tenants.is_active', 'tenants.created_at',
];

// ============================================================================
// 1. OVERVIEW STATS
// ============================================================================

router.get('/stats', async (req, res, next) => {
  try {
    const [tenants] = await db.selectFrom('tenants').select([
      (eb) => eb.fn.countAll().as('total'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.active').as('active'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.trial').as('trial'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('subscription_status', '=', 'tenant.status.suspended').as('suspended'),
      eb => eb.selectFrom('tenants').select(e2 => e2.fn.countAll().as('c')).where('tenants.created_at', '>=', new Date(Date.now() - 30 * 86400000)).as('signups_30d'),
    ]).execute();

    const [users] = await db.selectFrom('users').select(e => [e.fn.countAll().as('total')]).execute();
    const [patients] = await db.selectFrom('patients').select(e => [e.fn.countAll().as('total')]).execute();
    const [appointments] = await db.selectFrom('appointments').select(e => [e.fn.countAll().as('total')]).execute();

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

// ============================================================================
// 2. TENANT LIST + DETAIL + PATCH (existing, enhanced with plan_id)
// ============================================================================

router.get('/tenants',
  query('search').optional().isString().trim().isLength({ max: 100 }),
  query('status').optional().isIn(TENANT_SORT_STATUSES),
  query('plan').optional().isString().trim().isLength({ max: 50 }),
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
      const plan = req.query.plan;
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

      let q = db.selectFrom('tenants').select([...tenantColumns, ...countSelect]);
      let cq = db.selectFrom('tenants').select(e => [e.fn.countAll().as('total')]);

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
      if (plan) {
        q = q.where('tenants.subscription_plan', '=', plan);
        cq = cq.where('tenants.subscription_plan', '=', plan);
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

router.get('/tenants/export',
  query('search').optional().isString().trim(),
  query('status').optional().isIn(TENANT_SORT_STATUSES),
  async (req, res, next) => {
    try {
      let q = db.selectFrom('tenants').select([...tenantColumns, ...countSelect]);
      if (req.query.search) {
        const like = `%${req.query.search.replace(/[\\%_]/g, m => '\\' + m)}%`;
        q = q.where(eb => eb.or([eb('tenants.name', 'ilike', like), eb('tenants.subdomain', 'ilike', like)]));
      }
      if (req.query.status) {
        q = q.where('tenants.subscription_status', '=', `tenant.status.${req.query.status}`);
      }
      const rows = await q.orderBy('tenants.created_at', 'desc').execute();
      const header = 'Name,Subdomain,Status,Plan,Users,Patients,Appointments,Created\n';
      const csv = header + rows.map(r =>
        `"${(r.name||'').replace(/"/g,'""')}","${r.subdomain}","${r.subscription_status.replace('tenant.status.','')}","${r.subscription_plan||''}",${r.user_count},${r.patient_count},${r.appointment_count},"${r.created_at}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=clinics.csv');
      return res.send(csv);
    } catch (e) { next(e); }
  }
);

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

      // Revenue for this tenant
      const [revRow] = await db.selectFrom('platform_invoices')
        .select(e => [
          e.fn.coalesce(e.fn.sum('amount_dzd'), e.val(0)).as('total_billed'),
          e.fn.countAll().as('invoice_count'),
        ])
        .where('tenant_id', '=', req.params.id)
        .execute();

      return res.json({
        tenant: {
          ...tenant,
          user_count: Number(tenant.user_count),
          patient_count: Number(tenant.patient_count),
          appointment_count: Number(tenant.appointment_count),
          total_billed: Number(revRow?.total_billed || 0),
          invoice_count: Number(revRow?.invoice_count || 0),
        },
        users,
      });
    } catch (e) { next(e); }
  }
);

router.patch('/tenants/:id',
  param('id').isUUID(),
  body('name').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('subscription_status').optional().isIn(SUBSCRIPTION_STATUSES),
  body('subscription_plan').optional().isString().trim().isLength({ max: 50 }),
  body('subscription_ends_at').optional({ nullable: true }).isISO8601(),
  body('subscription_started_at').optional({ nullable: true }).isISO8601(),
  body('plan_id').optional({ nullable: true }).isUUID(),
  body('is_active').optional().isBoolean(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const updates = {};
      for (const field of ['name', 'subscription_status', 'subscription_plan', 'subscription_ends_at', 'subscription_started_at', 'plan_id', 'is_active']) {
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
      await auditLog(req.user, 'tenant.update', tenant.id, tenant.name, { fields: Object.keys(updates) }, req.ip);

      return res.json({ tenant: updated });
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 3. REVENUE DASHBOARD
// ============================================================================

router.get('/revenue', async (req, res, next) => {
  try {
    // MRR = sum of monthly prices for active paying tenants
    const mrr = await db.selectFrom('tenants')
      .innerJoin('platform_plans', 'tenants.plan_id', 'platform_plans.id')
      .select(e => [e.fn.coalesce(e.fn.sum('platform_plans.monthly_price_dzd'), e.val(0)).as('mrr')])
      .where('tenants.subscription_status', 'in', ['tenant.status.active', 'tenant.status.trial'])
      .executeTakeFirst();

    // Total revenue collected
    const totalRev = await db.selectFrom('platform_invoices')
      .select(e => [e.fn.coalesce(e.fn.sum('amount_dzd'), e.val(0)).as('total')])
      .where('status', '=', 'platform_invoice.paid')
      .executeTakeFirst();

    // Outstanding
    const outstanding = await db.selectFrom('platform_invoices')
      .select(e => [e.fn.coalesce(e.fn.sum('amount_dzd'), e.val(0)).as('total')])
      .where('status', 'in', ['platform_invoice.sent', 'platform_invoice.draft'])
      .executeTakeFirst();

    // Revenue by month (last 12 months)
    const months = await db.selectFrom('platform_invoices')
      .select([
        sql`date_trunc('month', platform_invoices.paid_at)`.as('month'),
        e => e.fn.coalesce(e.fn.sum('amount_dzd'), e.val(0)).as('revenue'),
        e => e.fn.countAll().as('count'),
      ])
      .where('status', '=', 'platform_invoice.paid')
      .where('paid_at', '>=', new Date(Date.now() - 365 * 86400000))
      .groupBy(sql`date_trunc('month', platform_invoices.paid_at)`)
      .orderBy('month', 'asc')
      .execute();

    // Revenue per tenant (top 20)
    const perTenant = await db.selectFrom('platform_invoices')
      .innerJoin('tenants', 'platform_invoices.tenant_id', 'tenants.id')
      .select([
        'tenants.id', 'tenants.name', 'tenants.subdomain',
        e => e.fn.coalesce(e.fn.sum('platform_invoices.amount_dzd'), e.val(0)).as('total'),
        e => e.fn.countAll().as('invoices'),
      ])
      .where('platform_invoices.status', '=', 'platform_invoice.paid')
      .groupBy(['tenants.id', 'tenants.name', 'tenants.subdomain'])
      .orderBy('total', 'desc')
      .limit(20)
      .execute();

    return res.json({
      mrr: Number(mrr?.mrr || 0),
      total_revenue: Number(totalRev?.total || 0),
      outstanding: Number(outstanding?.total || 0),
      monthly: months.map(r => ({ month: r.month, revenue: Number(r.revenue), count: Number(r.count) })),
      per_tenant: perTenant.map(r => ({ ...r, total: Number(r.total), invoices: Number(r.invoices) })),
    });
  } catch (e) { next(e); }
});

// ============================================================================
// 4. PLATFORM PLANS CRUD
// ============================================================================

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await db.selectFrom('platform_plans')
      .selectAll()
      .orderBy('sort_order', 'asc')
      .execute();
    return res.json(plans.map(p => ({ ...p, monthly_price_dzd: Number(p.monthly_price_dzd), annual_price_dzd: Number(p.annual_price_dzd) })));
  } catch (e) { next(e); }
});

router.post('/plans',
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('label').isString().trim().isLength({ min: 2, max: 100 }),
  body('monthly_price_dzd').isNumeric(),
  body('annual_price_dzd').isNumeric(),
  body('max_users').isInt({ min: 1 }),
  body('max_patients').isInt({ min: 1 }),
  body('features').optional().isArray(),
  body('sort_order').optional().isInt(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const [plan] = await db.insertInto('platform_plans').values({
        name: req.body.name,
        label: req.body.label,
        monthly_price_dzd: req.body.monthly_price_dzd,
        annual_price_dzd: req.body.annual_price_dzd,
        max_users: req.body.max_users,
        max_patients: req.body.max_patients,
        features: JSON.stringify(req.body.features || []),
        sort_order: req.body.sort_order || 0,
      }).returningAll().execute();
      await auditLog(req.user, 'plan.create', null, null, { plan: plan.name }, req.ip);
      return res.status(201).json(plan);
    } catch (e) { next(e); }
  }
);

router.patch('/plans/:id',
  param('id').isUUID(),
  body('label').optional().isString().trim().isLength({ min: 2, max: 100 }),
  body('monthly_price_dzd').optional().isNumeric(),
  body('annual_price_dzd').optional().isNumeric(),
  body('max_users').optional().isInt({ min: 1 }),
  body('max_patients').optional().isInt({ min: 1 }),
  body('features').optional().isArray(),
  body('is_active').optional().isBoolean(),
  body('sort_order').optional().isInt(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const updates = {};
      for (const f of ['label', 'monthly_price_dzd', 'annual_price_dzd', 'max_users', 'max_patients', 'is_active', 'sort_order']) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      if (req.body.features !== undefined) updates.features = JSON.stringify(req.body.features);
      if (Object.keys(updates).length === 0) return error(res, 400, 'validation.error');
      updates.updated_at = new Date();
      const [plan] = await db.updateTable('platform_plans').set(updates).where('id', '=', req.params.id).returningAll().execute();
      if (!plan) return error(res, 404, 'platform.error.plan_not_found');
      await auditLog(req.user, 'plan.update', null, null, { plan: plan.name, fields: Object.keys(updates) }, req.ip);
      return res.json(plan);
    } catch (e) { next(e); }
  }
);

router.delete('/plans/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const [plan] = await db.deleteFrom('platform_plans').where('id', '=', req.params.id).returningAll().execute();
      if (!plan) return error(res, 404, 'platform.error.plan_not_found');
      await auditLog(req.user, 'plan.delete', null, null, { plan: plan.name }, req.ip);
      return res.status(204).end();
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 5. PLATFORM INVOICING
// ============================================================================

router.get('/invoices',
  query('tenant_id').optional().isUUID(),
  query('status').optional().isString().trim(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      let q = db.selectFrom('platform_invoices')
        .innerJoin('tenants', 'platform_invoices.tenant_id', 'tenants.id')
        .select([
          'platform_invoices.id', 'platform_invoices.invoice_number', 'platform_invoices.amount_dzd',
          'platform_invoices.status', 'platform_invoices.period_start', 'platform_invoices.period_end',
          'platform_invoices.issued_at', 'platform_invoices.paid_at', 'platform_invoices.created_at',
          'tenants.name as tenant_name', 'tenants.subdomain as tenant_subdomain',
        ]);
      let cq = db.selectFrom('platform_invoices').select(e => [e.fn.countAll().as('total')]);
      if (req.query.tenant_id) {
        q = q.where('platform_invoices.tenant_id', '=', req.query.tenant_id);
        cq = cq.where('platform_invoices.tenant_id', '=', req.query.tenant_id);
      }
      if (req.query.status) {
        q = q.where('platform_invoices.status', '=', req.query.status);
        cq = cq.where('platform_invoices.status', '=', req.query.status);
      }
      const [rows, [count]] = await Promise.all([
        q.orderBy('platform_invoices.created_at', 'desc').limit(limit).offset((page - 1) * limit).execute(),
        cq.execute(),
      ]);
      return res.json({ invoices: rows.map(r => ({ ...r, amount_dzd: Number(r.amount_dzd) })), total: Number(count.total), page, limit });
    } catch (e) { next(e); }
  }
);

router.post('/invoices',
  body('tenant_id').isUUID(),
  body('plan_id').optional({ nullable: true }).isUUID(),
  body('period_start').isISO8601(),
  body('period_end').isISO8601(),
  body('amount_dzd').isNumeric(),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const tenant = await db.selectFrom('tenants').select(['id', 'name']).where('id', '=', req.body.tenant_id).executeTakeFirst();
      if (!tenant) return error(res, 404, 'platform.error.tenant_not_found');
      const invoiceNumber = await nextInvoiceNumber();
      const [inv] = await db.insertInto('platform_invoices').values({
        tenant_id: req.body.tenant_id,
        plan_id: req.body.plan_id || null,
        invoice_number: invoiceNumber,
        period_start: req.body.period_start,
        period_end: req.body.period_end,
        amount_dzd: req.body.amount_dzd,
        notes: req.body.notes || null,
        created_by: req.user.id,
      }).returningAll().execute();
      await auditLog(req.user, 'invoice.create', tenant.id, tenant.name, { invoice: invoiceNumber, amount: req.body.amount_dzd }, req.ip);
      return res.status(201).json(inv);
    } catch (e) { next(e); }
  }
);

router.patch('/invoices/:id',
  param('id').isUUID(),
  body('status').optional().isIn(['platform_invoice.draft', 'platform_invoice.sent', 'platform_invoice.paid', 'platform_invoice.void']),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const updates = {};
      if (req.body.status !== undefined) {
        updates.status = req.body.status;
        if (req.body.status === 'platform_invoice.sent') updates.issued_at = new Date();
        if (req.body.status === 'platform_invoice.paid') updates.paid_at = new Date();
      }
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (Object.keys(updates).length === 0) return error(res, 400, 'validation.error');
      updates.updated_at = new Date();
      const [inv] = await db.updateTable('platform_invoices').set(updates).where('id', '=', req.params.id).returningAll().execute();
      if (!inv) return error(res, 404, 'platform.error.invoice_not_found');
      const tenant = await db.selectFrom('tenants').select('name').where('id', '=', inv.tenant_id).executeTakeFirst();
      await auditLog(req.user, 'invoice.' + (req.body.status || 'update'), inv.tenant_id, tenant?.name, { invoice: inv.invoice_number, status: req.body.status }, req.ip);
      return res.json(inv);
    } catch (e) { next(e); }
  }
);

router.delete('/invoices/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const [inv] = await db.deleteFrom('platform_invoices').where('id', '=', req.params.id).returningAll().execute();
      if (!inv) return error(res, 404, 'platform.error.invoice_not_found');
      await auditLog(req.user, 'invoice.delete', inv.tenant_id, null, { invoice: inv.invoice_number }, req.ip);
      return res.status(204).end();
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 6. GROWTH ANALYTICS
// ============================================================================

router.get('/analytics', async (req, res, next) => {
  try {
    // Signup trend (last 12 months)
    const cutoff = new Date(Date.now() - 365 * 86400000);
    const signups = await db.selectFrom('tenants')
      .select([
        sql`date_trunc('month', tenants.created_at)`.as('month'),
        sql`COUNT(*)::int`.as('count'),
      ])
      .where('tenants.created_at', '>=', cutoff)
      .groupBy(sql`date_trunc('month', tenants.created_at)`)
      .orderBy('month', 'asc')
      .execute();

    // Status distribution
    const dist = await db.selectFrom('tenants').select([
      e => e.fn.countAll().as('total'),
      e => e.fn.sum(sql`CASE WHEN ${e.ref('subscription_status')} = 'tenant.status.active' THEN 1 ELSE 0 END`).as('active'),
      e => e.fn.sum(sql`CASE WHEN ${e.ref('subscription_status')} = 'tenant.status.trial' THEN 1 ELSE 0 END`).as('trial'),
      e => e.fn.sum(sql`CASE WHEN ${e.ref('subscription_status')} = 'tenant.status.suspended' THEN 1 ELSE 0 END`).as('suspended'),
      e => e.fn.sum(sql`CASE WHEN ${e.ref('subscription_status')} = 'tenant.status.cancelled' THEN 1 ELSE 0 END`).as('cancelled'),
      e => e.fn.sum(sql`CASE WHEN ${e.ref('subscription_status')} = 'tenant.status.expired' THEN 1 ELSE 0 END`).as('expired'),
    ]).executeTakeFirst();

    // Churn: tenants that became cancelled/expired in last 90 days
    const churn = await db.selectFrom('tenants')
      .select(e => [e.fn.countAll().as('count')])
      .where('subscription_status', 'in', ['tenant.status.cancelled', 'tenant.status.expired'])
      .where('updated_at', '>=', new Date(Date.now() - 90 * 86400000))
      .executeTakeFirst();

    // Plan distribution
    const planDist = await db.selectFrom('tenants')
      .select([
        e => e.fn.coalesce(e.ref('subscription_plan'), e.val('unassigned')).as('plan'),
        e => e.fn.countAll().as('count'),
      ])
      .groupBy('subscription_plan')
      .execute();

    // Patient growth (last 12 months)
    const patientGrowth = await db.selectFrom('patients')
      .select([
        sql`date_trunc('month', patients.created_at)`.as('month'),
        sql`COUNT(*)::int`.as('count'),
      ])
      .where('patients.created_at', '>=', cutoff)
      .groupBy(sql`date_trunc('month', patients.created_at)`)
      .orderBy('month', 'asc')
      .execute();

    return res.json({
      signups: signups.map(r => ({ month: r.month, count: Number(r.count) })),
      distribution: {
        total: Number(dist?.total || 0),
        active: Number(dist?.active || 0),
        trial: Number(dist?.trial || 0),
        suspended: Number(dist?.suspended || 0),
        cancelled: Number(dist?.cancelled || 0),
        expired: Number(dist?.expired || 0),
      },
      churn_90d: Number(churn?.count || 0),
      plans: planDist.map(r => ({ plan: r.plan, count: Number(r.count) })),
      patient_growth: patientGrowth.map(r => ({ month: r.month, count: Number(r.count) })),
    });
  } catch (e) { next(e); }
});

// ============================================================================
// 7. BULK ACTIONS + CSV EXPORT
// ============================================================================

router.post('/tenants/bulk',
  body('ids').isArray({ min: 1, max: 100 }),
  body('ids.*').isUUID(),
  body('action').isIn(['suspend', 'activate', 'set_plan']),
  body('plan').optional().isString().trim().isLength({ max: 50 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const { ids, action, plan } = req.body;
      const updates = { updated_at: new Date() };
      if (action === 'suspend') updates.subscription_status = 'tenant.status.suspended';
      if (action === 'activate') updates.subscription_status = 'tenant.status.active';
      if (action === 'set_plan' && plan) updates.subscription_plan = plan;

      const result = await db.updateTable('tenants').set(updates)
        .where('id', 'in', ids)
        .executeTakeFirst();

      await auditLog(req.user, 'tenants.bulk_' + action, null, null, { ids, plan: plan || null }, req.ip);
      return res.json({ updated: Number(result.numUpdatedRows || 0) });
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 8. API USAGE / HEALTH
// ============================================================================

router.get('/usage', async (req, res, next) => {
  try {
    // Last 24h summary
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

    const [totals] = await db.selectFrom('api_usage_logs')
      .select([
        e => e.fn.countAll().as('total_requests'),
        e => e.fn.avg('duration_ms').as('avg_duration'),
        e => e.fn.max('duration_ms').as('max_duration'),
      ])
      .where('created_at', '>=', dayAgo)
      .executeTakeFirst();

    // Status code distribution
    const statusCodes = await db.selectFrom('api_usage_logs')
      .select([
        'status_code',
        e => e.fn.countAll().as('count'),
      ])
      .where('created_at', '>=', dayAgo)
      .groupBy('status_code')
      .orderBy('count', 'desc')
      .execute();

    // Requests per hour (last 24h)
    const hourly = await db.selectFrom('api_usage_logs')
      .select([
        sql`date_trunc('hour', api_usage_logs.created_at)`.as('hour'),
        e => e.fn.countAll().as('count'),
        e => e.fn.avg('duration_ms').as('avg_ms'),
      ])
      .where('created_at', '>=', dayAgo)
      .groupBy(sql`date_trunc('hour', api_usage_logs.created_at)`)
      .orderBy('hour', 'asc')
      .execute();

    // Top endpoints
    const topEndpoints = await db.selectFrom('api_usage_logs')
      .select([
        'path',
        'method',
        e => e.fn.countAll().as('count'),
        e => e.fn.avg('duration_ms').as('avg_ms'),
      ])
      .where('created_at', '>=', dayAgo)
      .groupBy(['path', 'method'])
      .orderBy('count', 'desc')
      .limit(20)
      .execute();

    // Error rate
    const [errors] = await db.selectFrom('api_usage_logs')
      .select(e => [e.fn.countAll().as('count')])
      .where('created_at', '>=', dayAgo)
      .where('status_code', '>=', 400)
      .executeTakeFirst();

    return res.json({
      period: '24h',
      total_requests: Number(totals?.total_requests || 0),
      avg_duration: Math.round(Number(totals?.avg_duration || 0)),
      max_duration: Number(totals?.max_duration || 0),
      error_count: Number(errors?.count || 0),
      error_rate: totals?.total_requests > 0 ? (Number(errors?.count || 0) / Number(totals.total_requests) * 100).toFixed(1) : '0.0',
      status_codes: statusCodes.map(r => ({ code: r.status_code, count: Number(r.count) })),
      hourly: hourly.map(r => ({ hour: r.hour, count: Number(r.count), avg_ms: Math.round(Number(r.avg_ms)) })),
      top_endpoints: topEndpoints.map(r => ({ path: r.path, method: r.method, count: Number(r.count), avg_ms: Math.round(Number(r.avg_ms)) })),
    });
  } catch (e) { next(e); }
});

// ============================================================================
// 9. PLATFORM AUDIT TRAIL
// ============================================================================

router.get('/audit',
  query('operator').optional().isString().trim().isLength({ max: 100 }),
  query('action').optional().isString().trim().isLength({ max: 100 }),
  query('tenant_id').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
      let q = db.selectFrom('platform_audit_log').selectAll();
      let cq = db.selectFrom('platform_audit_log').select(e => [e.fn.countAll().as('total')]);
      if (req.query.operator) {
        const like = `%${req.query.operator}%`;
        q = q.where('operator_email', 'ilike', like);
        cq = cq.where('operator_email', 'ilike', like);
      }
      if (req.query.action) {
        q = q.where('action', 'ilike', `%${req.query.action}%`);
        cq = cq.where('action', 'ilike', `%${req.query.action}%`);
      }
      if (req.query.tenant_id) {
        q = q.where('target_tenant_id', '=', req.query.tenant_id);
        cq = cq.where('target_tenant_id', '=', req.query.tenant_id);
      }
      const [rows, [count]] = await Promise.all([
        q.orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit).execute(),
        cq.execute(),
      ]);
      return res.json({ entries: rows, total: Number(count.total), page, limit });
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 10. IMPERSONATION
// ============================================================================

router.post('/impersonate/:tenantId',
  param('tenantId').isUUID(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const tenant = await db.selectFrom('tenants').selectAll().where('id', '=', req.params.tenantId).executeTakeFirst();
      if (!tenant) return error(res, 404, 'platform.error.tenant_not_found');

      // Find the admin user for this tenant
      const admin = await db.selectFrom('users')
        .innerJoin('roles', 'users.role_id', 'roles.id')
        .select(['users.id', 'users.email', 'users.full_name', 'roles.role_key'])
        .where('users.tenant_id', '=', req.params.tenantId)
        .where('roles.role_key', '=', 'auth.role.admin')
        .where('users.status_key', '=', 'user.status.active')
        .executeTakeFirst();

      if (!admin) return error(res, 404, 'platform.error.no_admin_user');

      const crypto = require('node:crypto');
      const jwt = require('jsonwebtoken');

      const token = jwt.sign(
        {
          jti: crypto.randomUUID(),
          id: admin.id,
          email: admin.email,
          role_key: admin.role_key,
          tenant_id: tenant.id,
          impersonated_by: req.user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      await auditLog(req.user, 'impersonate', tenant.id, tenant.name, { target_admin: admin.email }, req.ip);

      return res.json({
        token,
        tenant: { id: tenant.id, name: tenant.name, subdomain: tenant.subdomain },
        user: { id: admin.id, email: admin.email, full_name: admin.full_name, role_key: admin.role_key },
      });
    } catch (e) { next(e); }
  }
);

// ============================================================================
// 11. ANNOUNCEMENTS
// ============================================================================

router.get('/announcements',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const [rows, [count]] = await Promise.all([
        db.selectFrom('platform_announcements').selectAll()
          .orderBy('sent_at', 'desc').limit(limit).offset((page - 1) * limit).execute(),
        db.selectFrom('platform_announcements').select(e => [e.fn.countAll().as('total')]).execute(),
      ]);
      return res.json({ announcements: rows, total: Number(count.total), page, limit });
    } catch (e) { next(e); }
  }
);

router.post('/announcements',
  body('title').isString().trim().isLength({ min: 2, max: 255 }),
  body('body').isString().trim().isLength({ min: 2, max: 5000 }),
  body('target').optional().isIn(['announcement.target.all', 'announcement.target.selected', 'announcement.target.plan']),
  body('target_tenant_ids').optional().isArray(),
  body('channel').optional().isIn(['announcement.channel.in_app', 'announcement.channel.email', 'announcement.channel.both']),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation.error', details: errors.array() });
    try {
      const [ann] = await db.insertInto('platform_announcements').values({
        title: req.body.title,
        body: req.body.body,
        target: req.body.target || 'announcement.target.all',
        target_tenant_ids: req.body.target_tenant_ids || [],
        channel: req.body.channel || 'announcement.channel.in_app',
        sent_by: req.user.id,
        sent_by_email: req.user.email,
      }).returningAll().execute();
      await auditLog(req.user, 'announcement.send', null, null, { title: ann.title, target: ann.target }, req.ip);
      return res.status(201).json(ann);
    } catch (e) { next(e); }
  }
);

router.get('/announcements/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const ann = await db.selectFrom('platform_announcements').selectAll().where('id', '=', req.params.id).executeTakeFirst();
      if (!ann) return error(res, 404, 'platform.error.announcement_not_found');
      // Read count
      const reads = await db.selectFrom('announcement_reads')
        .select(e => [e.fn.countAll().as('count')])
        .where('announcement_id', '=', req.params.id)
        .executeTakeFirst();
      return res.json({ ...ann, read_count: Number(reads?.count || 0) });
    } catch (e) { next(e); }
  }
);

router.delete('/announcements/:id',
  param('id').isUUID(),
  async (req, res, next) => {
    try {
      const [ann] = await db.deleteFrom('platform_announcements').where('id', '=', req.params.id).returningAll().execute();
      if (!ann) return error(res, 404, 'platform.error.announcement_not_found');
      await auditLog(req.user, 'announcement.delete', null, null, { title: ann.title }, req.ip);
      return res.status(204).end();
    } catch (e) { next(e); }
  }
);

module.exports = router;
