const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sql } = require('kysely');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const success = (res, message) => {
  return res.json({ success: true, message: message })
}
const error = (res, code, error) => {
  return res.status(code).json({ success: false, error: error })
}

router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {

    // Validate input first before opening DB connection
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, 402, 'validation.error');
    }

    try {
      const { email, password } = req.body;

      const result = await sql`SELECT * FROM get_user_by_email(${email})`.execute(db);
      const user = result.rows[0];

      if (!user) {
        return error(res, 401, 'auth.error.invalid_credentials');
      }

      if (user.status_key !== 'user.status.active') {
        return error(res, 403, 'auth.error.account_inactive');
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return error(res, 401, 'auth.error.invalid_credentials');
      }

      const generateTokens = (user) => {
        const accessToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role_key: user.role_key,
            tenant_id: user.tenant_id
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        const refreshToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            tenant_id: user.tenant_id
          },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
        );

        return { accessToken, refreshToken };
      };

      const { accessToken, refreshToken } = generateTokens(user);

      const newLoginTime = new Date();

      await db
        .updateTable('users')
        .set({ last_login_at: newLoginTime })
        .where('id', '=', user.id)
        .execute();


      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'users',
          entityId: user.id,
          tenantId: user.tenant_id,
          oldValues: { last_login_at: user.last_login_at },
          newValues: { last_login_at: newLoginTime }
        });
      }

      return res.json({
        accessToken,
        refreshToken,
        id: user.id,
        fullName: user.full_name,
        roleKey: user.role_key,
        tenantId: user.tenant_id
      });

    } catch (err) {
      next(err);
    }
  }
);

// Validate token
router.get('/validate', authenticate, async (req, res, next) => {
  try {
    const user = await db
      .selectFrom('users')
      .innerJoin('roles', 'users.role_id', 'roles.id')
      .select([
        'users.id',
        'users.full_name',
        'users.status_key',
        'users.tenant_id',
        'roles.role_key'
      ])
      .where('users.id', '=', req.user.id)
      .where('users.tenant_id', '=', req.user.tenant_id)
      .executeTakeFirst();

    if (!user) {
      return error(res, 401, 'auth.error.invalid_token');
    }

    if (user.status_key !== 'user.status.active') {
      return error(res, 403, 'auth.error.account_inactive');
    }

    // Return the new token if it was refreshed, otherwise the one from the request
    const accessToken = res.getHeader('x-access-token') || req.headers.authorization?.split(' ')[1];
    const refreshToken = req.headers['x-refresh-token'];

    return res.json({
      accessToken,
      refreshToken,
      id: user.id,
      fullName: user.full_name,
      roleKey: user.role_key,
      tenantId: user.tenant_id
    });
  } catch (e) {
    return error(res, 401, 'auth.error.invalid_token');
  }
});

module.exports = router;
