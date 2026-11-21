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

  // Two client clocks are involved and they are NOT the server's clock:
  //  - X-Client-Timestamp header: the client's clock when it SENT this request
  //  - body.clientTimestamp:      the client's clock when the edit was MADE
  //                               (only an offline-replayed edit carries one)
  // Comparing either raw value with the server's updated_at turns any clock
  // skew into false conflicts: a PC running 1 minute slow had every save of a
  // just-created appointment rejected with 409 (calendar drags snapped back).
  // So: a live edit (no edit time) is happening now and is never stale; an
  // offline edit's time is shifted into server time by the sender's measured
  // offset (server now - header).
  const editTime = parseTimestamp(req.body?.clientTimestamp);
  const sentTime = parseTimestamp(req.headers['x-client-timestamp']);

  if (req.body?.clientTimestamp !== undefined) {
    delete req.body.clientTimestamp;
  }

  if (Number.isNaN(editTime)) {
    return next();
  }

  const clockOffset = Number.isNaN(sentTime) ? 0 : Date.now() - sentTime;
  req.clientTimestamp = editTime + clockOffset;

  res.conflictCheck = (record) => {
    if (!record?.updated_at) return false;

    const serverTime = parseTimestamp(record.updated_at);
    if (Number.isNaN(serverTime)) return false;

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
