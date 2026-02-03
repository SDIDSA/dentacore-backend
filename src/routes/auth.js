const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

const success = (res, message) => {
  return res.json({ success: true, message: message })
}
const error = (res, code, error) => {
  return res.status(code).json({ success: false, error: error })
}

// Login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return error(res, 402, 'validation.error');
      }

      const { email, password } = req.body;

      const user = await db
        .selectFrom('users')
        .innerJoin('roles', 'users.role_id', 'roles.id')
        .select([
          'users.id',
          'users.email',
          'users.password_hash',
          'users.full_name',
          'users.status_key',
          'users.last_login_at',
          'roles.role_key'
        ])
        .where('users.email', '=', email)
        .executeTakeFirst();

      if (!user) {
        return error(res, 401, 'auth.error.invalid_credentials')
      }

      if (user.status_key !== 'user.status.active') {
        return error(res, 403, 'auth.error.account_inactive');
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return error(res, 401, 'auth.error.invalid_credentials')
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role_key: user.role_key },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      const newLoginTime = new Date();

      await db
        .updateTable('users')
        .set({ last_login_at: newLoginTime })
        .where('id', '=', user.id)
        .execute();

      // Audit log: Login (User Update)
      await req.audit.log({
        action: 'UPDATE',
        entityType: 'users',
        entityId: user.id,
        oldValues: { last_login_at: user.last_login_at },
        newValues: { last_login_at: newLoginTime }
      });

      return res.json({
        token,
        id: user.id,
        fullName: user.full_name,
        roleKey: user.role_key,

      });
    } catch (error) {
      next(error);
    }
  }
);

// Validate token
router.get('/validate', async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return error(res, 401, 'auth.error.no_token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .select([
        'users.id',
        'users.full_name',
        'users.status_key',
        'roles.role_key'
      ])
      .where('users.id', '=', decoded.id)
      .executeTakeFirst();

    if (!user) {
      return error(res, 401, 'auth.error.invalid_token');
    }

    if (user.status_key !== 'user.status.active') {
      return error(res, 403, 'auth.error.account_inactive');
    }

    return res.json({
      token,
      id: user.id,
      fullName: user.full_name,
      roleKey: user.role_key,
    });
  } catch (e) {
    return error(res, 401, 'auth.error.invalid_token');
  }
});

module.exports = router;
