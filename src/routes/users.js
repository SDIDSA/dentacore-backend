const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply admin authorization to all routes
router.use(authorize('auth.role.admin'));

// Get all users
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, role } = req.query;
    const offset = (page - 1) * limit;

    let query = db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .leftJoin('wilayas', 'users.wilaya_id', 'wilayas.id')
      .select([
        'users.id',
        'users.email',
        'users.full_name',
        'users.phone',
        'users.address',
        'users.is_active',
        'users.last_login_at',
        'users.created_at',
        'roles.role_key',
        'wilayas.name_key as wilaya_name_key'
      ]);

    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('users.full_name', 'ilike', `%${search}%`),
          eb('users.email', 'ilike', `%${search}%`)
        ])
      );
    }

    if (role) {
      query = query.where('roles.role_key', '=', role);
    }

    const users = await query
      .orderBy('users.created_at', 'desc')
      .limit(Number(limit))
      .offset(Number(offset))
      .execute();

    // Get total count for pagination
    let countQuery = db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .select(db.fn.count('users.id').as('total'));

    if (search) {
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb('users.full_name', 'ilike', `%${search}%`),
          eb('users.email', 'ilike', `%${search}%`)
        ])
      );
    }

    if (role) {
      countQuery = countQuery.where('roles.role_key', '=', role);
    }

    const { total } = await countQuery.executeTakeFirst();

    res.json({
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: Number(total),
        pages: Math.ceil(Number(total) / Number(limit))
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const user = await db
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
        'users.is_active',
        'users.last_login_at',
        'users.created_at',
        'users.updated_at',
        'roles.id as role_id',
        'roles.role_key',
        'wilayas.name_key as wilaya_name_key'
      ])
      .where('users.id', '=', req.params.id)
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ error: 'user.error.not_found' });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Create new user
router.post('/',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('full_name').trim().notEmpty(),
  body('phone').matches(/^\+213[0-9]{9}$/),
  body('role_id').isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const {
        email, password, full_name, phone, role_id,
        wilaya_id, address
      } = req.body;

      // Check if email already exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();

      if (existingUser) {
        return res.status(409).json({ error: 'user.error.email_exists' });
      }

      // Check if phone already exists
      const existingPhone = await db
        .selectFrom('users')
        .select('id')
        .where('phone', '=', phone)
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
          address: address || null
        })
        .returningAll()
        .executeTakeFirst();

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = newUser;

      res.status(201).json(userResponse);
    } catch (err) {
      next(err);
    }
  }
);

// Update user
router.put('/:id',
  body('email').optional().isEmail().normalizeEmail(),
  body('full_name').optional().trim().notEmpty(),
  body('phone').optional().matches(/^\+213[0-9]{9}$/),
  body('role_id').optional().isInt({ min: 1 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const userId = req.params.id;
      const {
        email, full_name, phone, role_id,
        wilaya_id, address, is_active
      } = req.body;

      // Check if user exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!existingUser) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }

      // Check for email conflicts (excluding current user)
      if (email) {
        const emailConflict = await db
          .selectFrom('users')
          .select('id')
          .where('email', '=', email)
          .where('id', '!=', userId)
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
      if (is_active !== undefined) updateData.is_active = is_active;

      // Update user
      const updatedUser = await db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updatedUser;

      res.json(userResponse);
    } catch (err) {
      next(err);
    }
  }
);

// Change user password
router.patch('/:id/password',
  body('new_password').isLength({ min: 8 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const userId = req.params.id;
      const { new_password } = req.body;

      // Check if user exists
      const existingUser = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', userId)
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
        .execute();

      res.json({ message: 'user.password.updated' });
    } catch (err) {
      next(err);
    }
  }
);

// Toggle user active status
router.patch('/:id/toggle-status', async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'user.error.cannot_deactivate_self' });
    }

    const user = await db
      .selectFrom('users')
      .select(['id', 'is_active'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ error: 'user.error.not_found' });
    }

    const updatedUser = await db
      .updateTable('users')
      .set({ is_active: !user.is_active })
      .where('id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    // Remove password hash from response
    const { password_hash: _, ...userResponse } = updatedUser;

    res.json(userResponse);
  } catch (err) {
    next(err);
  }
});

// Get available roles
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

module.exports = router;