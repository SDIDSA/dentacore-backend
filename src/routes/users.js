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
    const { search, role } = req.query;

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
        'users.status_key',
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
      .execute();

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get user by ID
router.get('/:id', async (req, res, next) => {
  try {
    var user = await db
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
      .executeTakeFirst();

    if (!user) {
      user = (await db
        .selectFrom('audit_logs')
        .select('old_values')
        .where('entity_type', '=', 'users')
        .where('action', '=', 'DELETE')
        .where('entity_id', '=', req.params.id)
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

      // Audit log: User Created
      const { password_hash: _ph, ...safeNewUser } = newUser;
      await req.audit.log({
        action: 'CREATE',
        entityType: 'users',
        entityId: newUser.id,
        newValues: safeNewUser
      });

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
  body('status_key').optional().isIn(['user.status.active', 'user.status.inactive', 'user.status.deleted']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

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
      if (status_key !== undefined) updateData.status_key = status_key;

      // Update user
      const updatedUser = await db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      // Audit log: User Updated
      const { password_hash: _oldPh, ...safeOldUser } = existingUser;
      const { password_hash: _newPh, ...safeNewUserUpdate } = updatedUser;
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'users',
        entityId: userId,
        oldValues: safeOldUser,
        newValues: safeNewUserUpdate
      });

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

      // Audit log: Password Changed
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'users',
        entityId: userId,
        oldValues: { password_changed: false },
        newValues: { password_changed: true }
      });

      res.json({ message: 'user.password.updated' });
    } catch (err) {
      next(err);
    }
  }
);

// Update user status
router.patch('/:id/status',
  body('status_key').isIn(['user.status.active', 'user.status.inactive', 'user.status.deleted']),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
      }

      const userId = req.params.id;
      const { status_key } = req.body;

      // Prevent admin from deactivating/deleting themselves
      if (userId === req.user.id && status_key !== 'user.status.active') {
        return res.status(400).json({ error: 'user.error.cannot_change_own_status' });
      }

      const user = await db
        .selectFrom('users')
        .select(['id', 'status_key'])
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return res.status(404).json({ error: 'user.error.not_found' });
      }

      const updatedUser = await db
        .updateTable('users')
        .set({ status_key })
        .where('id', '=', userId)
        .returningAll()
        .executeTakeFirst();

      // Audit log: Status Updated
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'users',
        entityId: userId,
        oldValues: { status_key: user.status_key },
        newValues: { status_key: updatedUser.status_key }
      });

      // Remove password hash from response
      const { password_hash: _, ...userResponse } = updatedUser;

      res.json(userResponse);
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
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ error: 'user.error.not_found' });
    }

    await db
      .deleteFrom('users')
      .where('id', '=', userId)
      .execute();

    // Audit log: User Deleted
    const { password_hash: _delPh, ...safeDeletedUser } = user;
    safeDeletedUser.status_key = 'user.status.deleted';
    await req.audit.log({
      action: 'DELETE',
      entityType: 'users',
      entityId: userId,
      oldValues: safeDeletedUser
    });

    res.json(safeDeletedUser);
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