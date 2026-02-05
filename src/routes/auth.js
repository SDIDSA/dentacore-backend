const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sql } = require('kysely');

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

    // Validate input first before opening DB connection
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return error(res, 402, 'validation.error');
    }

    try {
      const { email, password } = req.body;

      // 1. Fetch user using Auth Helper (Bypasses RLS)
      const result = await sql`SELECT * FROM get_user_by_email(${email})`.execute(db);
      const user = result.rows[0];

      // 2. Validate User & Password
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

      // 3. Generate Token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role_key: user.role_key,
          tenant_id: user.tenant_id
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
      );

      // 4. Update Login Time & Audit Log
      const newLoginTime = new Date();

      await db
        .updateTable('users')
        .set({ last_login_at: newLoginTime })
        .where('id', '=', user.id)
        .execute();


      // Audit log
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE',
          entityType: 'users',
          entityId: user.id,
          tenantId: user.tenant_id,
          oldValues: { last_login_at: user.last_login_at },
          newValues: { last_login_at: newLoginTime }
        }); // No transaction passed, uses global db
      }


      // 5. Response
      return res.json({
        token,
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
      .where('users.tenant_id', '=', decoded.tenant_id)
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
