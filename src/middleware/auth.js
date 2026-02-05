const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'auth.error.no_token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'auth.error.invalid_token' });
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
