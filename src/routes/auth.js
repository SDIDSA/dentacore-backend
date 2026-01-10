const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');

const router = express.Router();

// Login
router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'validation.error', details: errors.array() });
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
        return res.status(401).json({ error: 'auth.error.invalid_credentials' });
      }

      if (!user.is_active) {
        return res.status(403).json({ error: 'auth.error.account_inactive' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'auth.error.invalid_credentials' });
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

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role_key: user.role_key,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
