const jwt = require('jsonwebtoken');
const { sql } = require('kysely');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const refreshToken = req.headers['x-refresh-token'];

  if (!token) {
    return res.status(401).json({ error: 'auth.error.no_token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' && refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const result = await sql`SELECT * FROM get_user_by_email(${decodedRefresh.email})`.execute(db);
        const user = result.rows[0];

        if (!user || user.status_key !== 'user.status.active') {
          return res.status(401).json({ error: 'auth.error.account_inactive' });
        }

        const newAccessToken = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role_key: user.role_key,
            tenant_id: user.tenant_id
          },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        res.setHeader('x-access-token', newAccessToken);

        req.user = {
          id: user.id,
          email: user.email,
          role_key: user.role_key,
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
    if (!req.user || !roles.includes(req.user.role_key)) {
      return res.status(403).json({ error: 'auth.error.forbidden' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
