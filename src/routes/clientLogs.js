const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { sql } = require('kysely');
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate } = require('../middleware/auth');
const { strictMutationLimiter } = require('../middleware/rateLimiter');
const { parsePagination } = require('../utils/paginate');

const router = express.Router();

const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.tenantId = decoded.tenant_id;
  } catch (_) {
    // optional auth - ignore invalid tokens
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || !Array.isArray(req.user.role_keys)) {
    return res.status(401).json({ error: 'auth.error.unauthorized' });
  }
  const isPlatformAdmin = req.user.role_keys.includes('auth.role.platform_admin');
  const isClinicAdmin = req.user.role_keys.includes('auth.role.admin');
  if (!isPlatformAdmin && !isClinicAdmin) {
    return res.status(403).json({ error: 'auth.error.forbidden' });
  }
  req.isPlatformAdmin = isPlatformAdmin;
  next();
};

// ---------------------------------------------------------------------------
// 1. INGESTION ENDPOINT: POST /api/v1/client-logs
// Tolerates unauthenticated requests (crashes before login) with rate limiting
// ---------------------------------------------------------------------------
router.post('/',
  strictMutationLimiter,
  optionalAuth,
  [
    body('app_version').isString().trim().isLength({ min: 1, max: 50 }).withMessage('app_version is required'),
    body('platform').isString().trim().isLength({ min: 1, max: 50 }).withMessage('platform is required'),
    body('error_type').isString().trim().isLength({ min: 1, max: 255 }).withMessage('error_type is required'),
    body('stack_trace').isString().trim().isLength({ min: 1 }).withMessage('stack_trace is required'),
    body('os_version').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
    body('message').optional({ nullable: true }).isString(),
    body('component').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
    body('device_info').optional({ nullable: true }).isObject(),
    body('tenant_id').optional({ nullable: true }).isUUID(),
    body('user_id').optional({ nullable: true }).isUUID(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const tenantId = req.tenantId || req.body.tenant_id || null;
      const userId = req.user?.id || req.body.user_id || null;

      const record = await db.insertInto('client_crashes')
        .values({
          tenant_id: tenantId,
          user_id: userId,
          app_version: req.body.app_version,
          platform: req.body.platform,
          os_version: req.body.os_version || null,
          error_type: req.body.error_type,
          message: req.body.message || null,
          stack_trace: req.body.stack_trace,
          component: req.body.component || null,
          device_info: JSON.stringify(req.body.device_info || {}),
        })
        .returning(['id', 'created_at'])
        .executeTakeFirst();

      logger.error('Client crash reported', {
        crashId: record.id,
        error_type: req.body.error_type,
        app_version: req.body.app_version,
        platform: req.body.platform,
        tenantId,
      });

      res.status(201).json({
        id: record.id,
        status: 'logged',
        created_at: record.created_at,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// 2. STATISTICS ENDPOINT: GET /api/v1/client-logs/stats
// Platform admin sees cross-tenant stats; Clinic admin sees own tenant stats
// ---------------------------------------------------------------------------
router.get('/stats', authenticate, requireAdmin, async (req, res, next) => {
  try {
    let baseQuery = db.selectFrom('client_crashes');
    if (!req.isPlatformAdmin) {
      baseQuery = baseQuery.where('client_crashes.tenant_id', '=', req.tenantId);
    }

    const counts = await baseQuery
      .select([
        sql`COUNT(*)`.as('total'),
        sql`COUNT(*) FILTER (WHERE resolved = FALSE)`.as('unresolved'),
        sql`COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')`.as('last_24h'),
      ])
      .executeTakeFirst();

    const byPlatform = await baseQuery
      .select(['platform', sql`COUNT(*)`.as('count')])
      .groupBy('platform')
      .execute();

    const topErrors = await baseQuery
      .select(['error_type', sql`COUNT(*)`.as('count')])
      .groupBy('error_type')
      .orderBy(sql`COUNT(*)`, 'desc')
      .limit(5)
      .execute();

    res.json({
      total: parseInt(counts?.total || 0, 10),
      unresolved: parseInt(counts?.unresolved || 0, 10),
      last_24h: parseInt(counts?.last_24h || 0, 10),
      by_platform: byPlatform.map(p => ({ platform: p.platform, count: parseInt(p.count, 10) })),
      top_errors: topErrors.map(e => ({ error_type: e.error_type, count: parseInt(e.count, 10) })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 3. REVIEW LIST ENDPOINT: GET /api/v1/client-logs
// ---------------------------------------------------------------------------
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    let limit = 50;
    let offset = 0;
    let page = 1;

    if (req.query.limit !== undefined) {
      const parsedLimit = parseInt(req.query.limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 200);
      }
    }

    if (req.query.page !== undefined) {
      const parsedPage = parseInt(req.query.page, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage;
        offset = (page - 1) * limit;
      }
    } else if (req.query.offset !== undefined) {
      const parsedOffset = parseInt(req.query.offset, 10);
      if (!isNaN(parsedOffset) && parsedOffset >= 0) {
        offset = parsedOffset;
        page = Math.floor(offset / limit) + 1;
      }
    }

    const {
      resolved,
      platform,
      app_version,
      error_type,
      tenant_id,
      search,
      start_date,
      end_date,
    } = req.query;

    let query = db
      .selectFrom('client_crashes')
      .leftJoin('tenants', 'client_crashes.tenant_id', 'tenants.id')
      .leftJoin('users', 'client_crashes.user_id', 'users.id')
      .select([
        'client_crashes.id',
        'client_crashes.tenant_id',
        'tenants.name as tenant_name',
        'tenants.subdomain as tenant_subdomain',
        'client_crashes.user_id',
        'users.email as user_email',
        'client_crashes.app_version',
        'client_crashes.platform',
        'client_crashes.os_version',
        'client_crashes.error_type',
        'client_crashes.message',
        'client_crashes.component',
        sql`SUBSTRING(client_crashes.stack_trace, 1, 300)`.as('stack_trace_preview'),
        'client_crashes.resolved',
        'client_crashes.resolved_at',
        'client_crashes.resolution_notes',
        'client_crashes.created_at',
      ]);

    if (!req.isPlatformAdmin) {
      query = query.where('client_crashes.tenant_id', '=', req.tenantId);
    } else if (tenant_id) {
      query = query.where('client_crashes.tenant_id', '=', tenant_id);
    }

    if (resolved !== undefined && resolved !== '') {
      query = query.where('client_crashes.resolved', '=', resolved === 'true' || resolved === true);
    }

    if (platform) {
      query = query.where('client_crashes.platform', '=', platform);
    }

    if (app_version) {
      query = query.where('client_crashes.app_version', '=', app_version);
    }

    if (error_type) {
      query = query.where('client_crashes.error_type', '=', error_type);
    }

    if (search) {
      const term = `%${search}%`;
      query = query.where((eb) =>
        eb.or([
          eb('client_crashes.error_type', 'ilike', term),
          eb('client_crashes.message', 'ilike', term),
          eb('client_crashes.component', 'ilike', term),
          eb('client_crashes.stack_trace', 'ilike', term),
        ])
      );
    }

    if (start_date) {
      query = query.where('client_crashes.created_at', '>=', start_date);
    }

    if (end_date) {
      query = query.where('client_crashes.created_at', '<=', end_date + ' 23:59:59');
    }

    const totalCountQuery = query.select([sql`COUNT(*) OVER()`.as('full_count')]);
    const items = await totalCountQuery
      .orderBy('client_crashes.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .execute();

    const total = items.length > 0 ? parseInt(items[0].full_count || 0, 10) : 0;
    const cleanedItems = items.map(({ full_count, ...rest }) => rest);

    res.json({
      data: cleanedItems,
      pagination: {
        page,
        limit,
        offset,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 4. DETAIL ENDPOINT: GET /api/v1/client-logs/:id
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, requireAdmin, [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let query = db
      .selectFrom('client_crashes')
      .leftJoin('tenants', 'client_crashes.tenant_id', 'tenants.id')
      .leftJoin('users as u1', 'client_crashes.user_id', 'u1.id')
      .leftJoin('users as u2', 'client_crashes.resolved_by', 'u2.id')
      .selectAll('client_crashes')
      .select([
        'tenants.name as tenant_name',
        'tenants.subdomain as tenant_subdomain',
        'u1.email as user_email',
        'u2.email as resolved_by_email',
      ])
      .where('client_crashes.id', '=', req.params.id);

    if (!req.isPlatformAdmin) {
      query = query.where('client_crashes.tenant_id', '=', req.tenantId);
    }

    const crash = await query.executeTakeFirst();
    if (!crash) {
      return res.status(404).json({ error: 'error.not_found' });
    }

    res.json(crash);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. UPDATE/RESOLVE ENDPOINT: PATCH /api/v1/client-logs/:id
// ---------------------------------------------------------------------------
router.patch('/:id',
  authenticate,
  requireAdmin,
  [
    param('id').isUUID(),
    body('resolved').optional().isBoolean(),
    body('resolution_notes').optional({ nullable: true }).isString(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let checkQuery = db.selectFrom('client_crashes').select(['id', 'tenant_id']).where('id', '=', req.params.id);
      if (!req.isPlatformAdmin) {
        checkQuery = checkQuery.where('tenant_id', '=', req.tenantId);
      }
      const existing = await checkQuery.executeTakeFirst();
      if (!existing) {
        return res.status(404).json({ error: 'error.not_found' });
      }

      const updates = {};
      if (req.body.resolved !== undefined) {
        updates.resolved = req.body.resolved;
        updates.resolved_at = req.body.resolved ? new Date() : null;
        updates.resolved_by = req.body.resolved ? req.user.id : null;
      }
      if (req.body.resolution_notes !== undefined) {
        updates.resolution_notes = req.body.resolution_notes;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'error.no_updates' });
      }

      const updated = await db
        .updateTable('client_crashes')
        .set(updates)
        .where('id', '=', req.params.id)
        .returningAll()
        .executeTakeFirst();

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// 6. DELETE ENDPOINT: DELETE /api/v1/client-logs/:id
// ---------------------------------------------------------------------------
router.delete('/:id', authenticate, requireAdmin, [param('id').isUUID()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let checkQuery = db.selectFrom('client_crashes').select(['id', 'tenant_id']).where('id', '=', req.params.id);
    if (!req.isPlatformAdmin) {
      checkQuery = checkQuery.where('tenant_id', '=', req.tenantId);
    }
    const existing = await checkQuery.executeTakeFirst();
    if (!existing) {
      return res.status(404).json({ error: 'error.not_found' });
    }

    await db.deleteFrom('client_crashes').where('id', '=', req.params.id).execute();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
