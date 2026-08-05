function conflictCheck(req, res, next) {
  if (!['PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  res.conflictCheck = () => false;

  const parseTimestamp = (value) => {
    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return numeric;
      }

      let candidate = value.trim();
      if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(candidate)) {
        candidate = candidate.replace(' ', 'T') + 'Z';
      }

      const parsed = Date.parse(candidate);
      return Number.isNaN(parsed) ? Number.NaN : parsed;
    }

    return Number.NaN;
  };

  const rawClientTimestamp = req.headers['x-client-timestamp'] ?? req.body?.clientTimestamp;
  const clientTimestamp = parseTimestamp(rawClientTimestamp);
  if (Number.isNaN(clientTimestamp)) {
    return next();
  }

  req.clientTimestamp = clientTimestamp;

  if (req.body?.clientTimestamp !== undefined) {
    delete req.body.clientTimestamp;
  }

  res.conflictCheck = (record) => {
    if (!record?.updated_at) return false;

    const serverTime = parseTimestamp(record.updated_at);
    if (Number.isNaN(serverTime)) return false;

    console.log('Conflict Check - Server Time:', serverTime, 'Client Time:', req.clientTimestamp);

    if (serverTime > req.clientTimestamp) {
      res.status(409).json({
        error: 'conflict.detected',
        message: 'The record was modified on the server after the client last synced. Client changes cannot be applied automatically.',
        serverTimestamp: serverTime,
        clientTimestamp: req.clientTimestamp,
      });
      return true;
    }
    return false;
  };

  next();
}

module.exports = conflictCheck;
