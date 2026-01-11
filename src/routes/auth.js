const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

const success = (res, message) => {
    return res.json({success : true, message : message})
}
const error = (res, code, error) => {
    return res.status(code).json({success : false, error : error})
}

// Login
router.post('/login',
  body('email').isEmail(),
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
          'users.is_active',
          'roles.role_key'
        ])
        .where('users.email', '=', email)
        .executeTakeFirst();

      if (!user) {
        return error(res, 401, 'auth.error.invalid_credentials')
      }

      if (!user.is_active) {
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

      await db
        .updateTable('users')
        .set({ last_login_at: new Date() })
        .where('id', '=', user.id)
        .execute();

        success(res, {
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role_key: user.role_key,
        },
      })
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
