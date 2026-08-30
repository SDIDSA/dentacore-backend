const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { sql } = require('kysely');
const db = require('../config/database');
const log = require('../utils/logger');
const { primaryRoleKey } = require('../utils/roleUtil');

function generateJti() {
  return crypto.randomUUID();
}

async function isTokenBlacklisted(jti) {
  const result = await db
    .selectFrom('token_blacklist')
    .select('id')
    .where('jti', '=', jti)
    .executeTakeFirst();
  return !!result;
}

async function blacklistToken(jti, tokenType, userId, tenantId, expiresAt) {
  const existing = await db
    .selectFrom('token_blacklist')
    .select('id')
    .where('jti', '=', jti)
    .executeTakeFirst();

  if (!existing) {
    await db
      .insertInto('token_blacklist')
      .values({
        jti,
        token_type: tokenType,
        user_id: userId,
        tenant_id: tenantId,
        expires_at: expiresAt
      })
      .execute();
  }
}

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];

  if (!token) {
    return res.status(401).json({ error: 'auth.error.no_token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (await isTokenBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: 'auth.error.token_revoked' });
    }
    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' && refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        if (await isTokenBlacklisted(decodedRefresh.jti)) {
          return res.status(401).json({ error: 'auth.error.token_revoked' });
        }

        const result = await sql`SELECT * FROM get_user_by_email(${decodedRefresh.email})`.execute(db);
        const user = result.rows[0];

        if (user?.status_key !== 'user.status.active') {
          return res.status(401).json({ error: 'auth.error.account_inactive' });
        }

        // Rotate: blacklist the old refresh token
        const refreshExp = new Date(decodedRefresh.exp * 1000);
        await blacklistToken(decodedRefresh.jti, 'refresh', user.id, user.tenant_id, refreshExp);

        // Issue new access token
        const accessJti = generateJti();
        const newAccessToken = jwt.sign(
          {
            jti: accessJti,
            id: user.id,
            email: user.email,
            role_key: primaryRoleKey(user.role_keys),
            role_keys: user.role_keys,
            tenant_id: user.tenant_id
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Issue new refresh token (rotation)
        const refreshJti = generateJti();
        const newRefreshToken = jwt.sign(
          {
            jti: refreshJti,
            id: user.id,
            email: user.email,
            tenant_id: user.tenant_id
          },
          process.env.JWT_REFRESH_SECRET,
          { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
        );

        res.setHeader('x-access-token', newAccessToken);
        res.setHeader('x-refresh-token', newRefreshToken);

        req.user = {
          jti: accessJti,
          id: user.id,
          email: user.email,
          role_key: primaryRoleKey(user.role_keys),
          role_keys: user.role_keys,
          tenant_id: user.tenant_id
        };
        req.tenantId = user.tenant_id;
        next();
      } catch (refreshErr) {
        if (refreshErr.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'auth.error.refresh_token_expired' });
        }
        return res.status(401).json({ error: 'auth.error.invalid_refresh_token' });
      }
    } else {
      return res.status(401).json({ error: 'auth.error.invalid_token' });
    }
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.role_keys;
    if (!userRoles || !roles.some((r) => userRoles.includes(r))) {
      return res.status(403).json({ error: 'auth.error.forbidden' });
    }
    next();
  };
};

// Periodic cleanup of expired blacklisted tokens (runs every hour)
async function cleanupExpiredTokens() {
  try {
    const result = await db
      .deleteFrom('token_blacklist')
      .where('expires_at', '<', new Date())
      .execute();
    if (result.numDeletedRows > 0n) {
      console.log(`Cleaned up ${result.numDeletedRows} expired blacklisted tokens`);
    }
  } catch (err) {
    console.error('Token cleanup failed:', err.message);
  }
}
// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000).unref();

module.exports = { authenticate, authorize };
