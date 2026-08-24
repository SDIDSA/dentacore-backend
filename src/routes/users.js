const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const conflictResolution = require('../middleware/conflictResolution');
const { sql } = require('kysely');
const db = require('../config/database');
const { parsePagination, wrapPaginatedResponse } = require('../utils/paginate');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);
router.use(conflictResolution);

// Apply admin authorization to all routes
router.use(authorize('auth.role.admin'));

function escapeIlike(str) {
  return String(str).replace(/([\\%_])/g, '\\$1');
}

// Search users by query
router.get('/search', async (req, res, next) => {
  try {
    const { search: query } = req.query;
    if (!query || query.trim().length === 0) {
      return res.json([]);
    }

    const sanitized = query.replace(/[^a-zA-Z0-9\s\-@._]/g, '');
    const results = await db
      .selectFrom('users')
      .select('users.id')
      .where('users.tenant_id', '=', req.tenantId)
      .where((eb) =>
        eb.or([
          eb('users.full_name', 'ilike', `%${sanitized}%`),
          eb('users.email', 'ilike', `%${sanitized}%`),
        ])
      )
      .limit(20)
      .execute();

    res.json(results.map(r => r.id));
  } catch (error) {
    next(error);
  }
});

// Rate limiters for sensitive operations
const createUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'auth.error.too_many_requests', details: 'Too many user creation attempts, please try again later' }
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'auth.error.too_many_requests', details: 'Too many password change attempts, please try again later' }
});


// Get all users
router.get('/', async (req, res, next) => {
  try {
    const { search, role } = req.query;
    const pag = parsePagination(req);

    let query = db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .select('users.id')
      .where('users.tenant_id', '=', req.tenantId);

    let countQuery = db
      .selectFrom('users')
      .select(sql`COUNT(*)`.as('count'))
      .where('users.tenant_id', '=', req.tenantId);

    if (search) {
      const searchFilter = (eb) =>
        eb.or([
          eb('users.full_name', 'ilike', `%${escapeIlike(search)}%`),
          eb('users.email', 'ilike', `%${escapeIlike(search)}%`)
        ]);
      query = query.where(searchFilter);
      countQuery = countQuery.where(searchFilter);
    }

    if (role) {
      query = query.where('roles.role_key', '=', role);
    }

    const users = await query
      .orderBy('users.created_at', 'desc')
      .limit(pag.paginate ? pag.limit : null)
      .offset(pag.paginate ? pag.offset : null)
      .execute();

    if (pag.paginate) {
      const countResult = await countQuery.executeTakeFirst();
      res.json(wrapPaginatedResponse(users.map(u => u.id), Number.parseInt(countResult.count), pag.limit, pag.offset));
    } else {
      res.json(users.map(u => u.id));
    }
  } catch (err) {
    next(err);
  }
});

// Get users by IDs (batch)
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

    const users = await db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('wilayas', 'users.wilaya_id', 'wilayas.id')
      .select([
        'users.id',
        'users.email',
        'users.full_name',
        'users.phone',
        'users.wilaya_id',
        'users.address',
        'users.status_key',
        'users.last_login_at',
        'users.created_at',
        'users.updated_at',
        'roles.id as role_id',
        'roles.role_key',
        'wilayas.name_key as wilaya_name_key'
      ])
      .where('users.id', 'in', idArray)
      .where('users.tenant_id', '=', req.tenantId)
      .execute();

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get available roles (must precede GET /:id so "meta" is not treated as an id)
router.get('/meta/roles', async (req, res, next) => {
  try {
    const roles = await db
      .selectFrom('roles')
      .select(['id', 'role_key', 'description'])
      .orderBy('role_key')
      .execute();

    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    let user = await db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('wilayas', 'users.wilaya_id', 'wilayas.id')
      .select([
        'users.id',
        'users.email',
        'users.full_name',
        'users.phone',
        'users.wilaya_id',
        'users.address',
        'users.status_key',
        'users.last_login_at',
        'users.created_at',
        'users.updated_at',
        'roles.id as role_id',
        'roles.role_key',
        'wilayas.name_key as wilaya_name_key'
      ])
      .where('users.id', '=', req.params.id)
      .where('users.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!user) {
      user = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'users')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst())?.old_values;

      if (!user) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Create new user
router.post('/', createUserLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().notEmpty(),
  body('phone').matches(/^\+213\d{9}$/),
  body('role_id').isInt({ min: 1 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const {
        email, password, full_name, phone, role_id,
        wilaya_id, address
      } = req.body;

      // Check if email already exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .where('tenant_id', '=', req.tenantId) // Technically email is unique per tenant
        .executeTakeFirst();

      if (existingUser) {
        return res.status(409).json({ error: 'user.error.email_exists' });
      }

      // Check if phone already exists
      const existingPhone = await db
        .selectFrom('users')
        .select('id')
        .where('phone', '=', phone)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (existingPhone) {
        return res.status(409).json({ error: 'user.error.phone_exists' });
      }

      // Verify role exists
      const role = await db
        .selectFrom('roles')
        .select('id')
        .where('id', '=', role_id)
        .executeTakeFirst();

      if (!role) {
        return res.status(400).json({ error: 'user.error.invalid_role' });
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Create user
      const newUser = await db
        .insertInto('users')
        .values({
          email,
          password_hash,
          full_name,
          phone,
          role_id,
          wilaya_id: wilaya_id || null,
          address: address || null,
          tenant_id: req.tenantId // Explicitly set tenant_id
        })
        .returningAll()
        .executeTakeFirst();

      // Audit log: User Created
      delete newUser.password_hash;
      if (req.audit) {
        await req.audit.log({
          action: 'CREATE',
          entityType: 'users',
          entityId: newUser.id,
          tenantId: req.tenantId,
          newValues: newUser
        }, db);
      }

      res.status(201).json(newUser);
    } catch (err) {
      next(err);
    }
  }
);

// Update user
router.patch('/:id',
  body('email').optional().isEmail().normalizeEmail(),
  body('full_name').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\+213\d{9}$/),
  body('role_id').optional().isInt({ min: 1 }),
  body('status_key').optional().isIn(['user.status.active', 'user.status.inactive', 'user.status.deleted']),
  async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const userId = req.params.id;
      const {
        email, full_name, phone, role_id,
        wilaya_id, address, status_key
      } = req.body;

      // Check if user exists
      const existingUser = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!existingUser) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }

      if (res.conflictCheck(existingUser)) return;

      // Check for email conflicts (excluding current user)
      if (email) {
        const emailConflict = await db
          .selectFrom('users')
          .select('id')
          .where('email', '=', email)
          .where('id', '!=', userId)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        if (emailConflict) {
          return res.status(409).json({ error: 'user.error.email_exists' });
        }
      }

      // Check for phone conflicts (excluding current user)
      if (phone) {
        const phoneConflict = await db
          .selectFrom('users')
          .select('id')
          .where('phone', '=', phone)
          .where('id', '!=', userId)
          .where('tenant_id', '=', req.tenantId)
          .executeTakeFirst();

        if (phoneConflict) {
          return res.status(409).json({ error: 'user.error.phone_exists' });
        }
      }

      // Verify role exists if provided
      if (role_id) {
        const role = await db
          .selectFrom('roles')
          .select('id')
          .where('id', '=', role_id)
          .executeTakeFirst();

        if (!role) {
          return res.status(400).json({ error: 'user.error.invalid_role' });
        }
      }

      // Build update object
      const updateData = {};
      if (email !== undefined) updateData.email = email;
      if (full_name !== undefined) updateData.full_name = full_name;
      if (phone !== undefined) updateData.phone = phone;
      if (role_id !== undefined) updateData.role_id = role_id;
      if (wilaya_id !== undefined) updateData.wilaya_id = wilaya_id;
      if (address !== undefined) updateData.address = address;
      if (status_key !== undefined) updateData.status_key = status_key;

      // Update user
      const updatedUser = await db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Audit log: User Updated
      delete existingUser.password_hash;
      delete updatedUser.password_hash;
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'users',
          entityId: userId,
          tenantId: req.tenantId,
          oldValues: existingUser,
          newValues: updatedUser
        }, db);
      }

      res.json(updatedUser);
    } catch (err) {
      next(err);
    }
  }
);

// Change user password
router.patch('/:id/password', changePasswordLimiter,
  body('new_password').isLength({ min: 8 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const userId = req.params.id;
      const { new_password } = req.body;

      // Check if user exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!existingUser) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }

      // Hash new password
      const password_hash = await bcrypt.hash(new_password, 12);

      // Update password
      await db
        .updateTable('users')
        .set({ password_hash })
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .execute();

      // Audit log: Password Changed
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'users',
          entityId: userId,
          tenantId: req.tenantId,
          oldValues: { password_changed: false },
          newValues: { password_changed: true }
        }, db);
      }

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }
);

// Update user status
router.patch('/:id/status',
  body('status_key').isIn(['user.status.active', 'user.status.inactive', 'user.status.deleted']),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }

    try {
      const userId = req.params.id;
      const { status_key } = req.body;

      // Prevent admin from deactivating/deleting themselves
      if (userId === req.user.id && status_key !== 'user.status.active') {
        return res.status(400).json({ error: 'user.error.cannot_change_own_status' });
      }

    let user = await db
      .selectFrom('users')
        .select(['id', 'status_key'])
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .executeTakeFirst();

      if (!user) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }

      const updatedUser = await db
        .updateTable('users')
        .set({ status_key })
        .where('id', '=', userId)
        .where('tenant_id', '=', req.tenantId)
        .returningAll()
        .executeTakeFirst();

      // Audit log: Status Updated
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'users',
          entityId: userId,
          tenantId: req.tenantId,
          oldValues: { status_key: user.status_key },
          newValues: { status_key: updatedUser.status_key }
        }, db);
      }

      // Remove password hash from response
      delete updatedUser.password_hash;
      res.json(updatedUser);
    } catch (err) {
      next(err);
    }
  }
);

// Delete user
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'user.error.cannot_delete_self' });
    }

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .where('tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ error: 'user.error.not_found' });
    }

    await db
      .deleteFrom('users')
      .where('id', '=', userId)
      .where('tenant_id', '=', req.tenantId)
      .execute();

    // Audit log: User Deleted
    delete user.password_hash;
    user.status_key = 'user.status.deleted';
    if (req.audit) {
      await req.audit.log({
        action: 'DELETE',
        entityType: 'users',
        entityId: userId,
        tenantId: req.tenantId,
        oldValues: user
      }, db);
    }

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;


