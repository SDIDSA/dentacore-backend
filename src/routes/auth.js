const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sql } = require('kysely');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');
const { primaryRoleKey } = require('../utils/roleUtil');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: 'auth.error.too_many_attempts' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const error = (res, code, err) => {
  return res.status(code).json({ error: err })
}

router.post('/login', loginLimiter,
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res, next) => {

    // Validate input first before opening DB connection
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
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
            jti: crypto.randomUUID(),
            id: user.id,
            email: user.email,
            role_key: primaryRoleKey(user.role_keys),
            role_keys: user.role_keys,
            tenant_id: user.tenant_id
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        const refreshToken = jwt.sign(
          {
            jti: crypto.randomUUID(),
            id: user.id,
            email: user.email,
            tenant_id: user.tenant_id
          },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        return { accessToken, refreshToken };
      };

      const { accessToken, refreshToken } = generateTokens(user);

      // Blacklist old refresh token on login for rotation security
      const oldRefreshToken = req.headers['x-refresh-token'];
      if (oldRefreshToken) {
        try {
          const oldDecoded = jwt.decode(oldRefreshToken);
          if (oldDecoded?.jti && oldDecoded.exp) {
            const existing = await db
              .selectFrom('token_blacklist')
              .select('id')
              .where('jti', '=', oldDecoded.jti)
              .executeTakeFirst();
            if (!existing) {
              await db.insertInto('token_blacklist').values({
                jti: oldDecoded.jti, token_type: 'refresh',
                user_id: user.id, tenant_id: user.tenant_id,
                expires_at: new Date(oldDecoded.exp * 1000)
              }).execute();
            }
          }
        } catch (err) { console.error('Token blacklist error:', err); }
      }

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
        roleKey: primaryRoleKey(user.role_keys),
        roleKeys: user.role_keys,
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
      .select([
        'users.id',
        'users.full_name',
        'users.status_key',
        'users.tenant_id',
        sql`ARRAY(SELECT rl.role_key FROM user_roles ur JOIN roles rl ON rl.id = ur.role_id WHERE ur.user_id = users.id)`.as('role_keys')
      ])
        .where('users.id', '=', req.user.id)
        .where('users.tenant_id', '=', req.tenantId)
      .executeTakeFirst();

    if (!user) {
      return error(res, 401, 'auth.error.invalid_token');
    }

    if (user.status_key !== 'user.status.active') {
      return error(res, 403, 'auth.error.account_inactive');
    }

    // Return the rotated tokens if issued, otherwise the ones from the request
    const accessToken = res.getHeader('x-access-token') || req.headers.authorization?.split(' ')[1];
    const refreshToken = res.getHeader('x-refresh-token') || req.headers['x-refresh-token'];

    return res.json({
      accessToken,
      refreshToken,
      id: user.id,
      fullName: user.full_name,
      roleKey: primaryRoleKey(user.role_keys),
      roleKeys: user.role_keys,
      tenantId: user.tenant_id
    });
  } catch (e) {
    logger.error('token validation failed', { error: e.message });
    return error(res, 401, 'auth.error.invalid_token');
  }
});

// Logout - revoke tokens
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const refreshToken = req.headers['x-refresh-token'];

    const tokens = [];
    if (authHeader) {
      const accessToken = authHeader.split(' ')[1];
      const decoded = jwt.decode(accessToken);
      if (decoded?.jti && decoded.exp) {
        tokens.push({
          jti: decoded.jti,
          token_type: 'access',
          user_id: req.user.id,
          tenant_id: req.tenantId,
          expires_at: new Date(decoded.exp * 1000)
        });
      }
    }

    if (refreshToken) {
      const decodedRefresh = jwt.decode(refreshToken);
      if (decodedRefresh?.jti && decodedRefresh.exp) {
        tokens.push({
          jti: decodedRefresh.jti,
          token_type: 'refresh',
          user_id: req.user.id,
          tenant_id: req.tenantId,
          expires_at: new Date(decodedRefresh.exp * 1000)
        });
      }
    }

    for (const token of tokens) {
      const existing = await db
        .selectFrom('token_blacklist')
        .select('id')
        .where('jti', '=', token.jti)
        .executeTakeFirst();

      if (!existing) {
        await db
          .insertInto('token_blacklist')
          .values(token)
          .execute();
      }
    }

    res.json({ message: 'auth.logout.success' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
