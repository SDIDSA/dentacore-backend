function conflictCheck(req, res, next) {
  if (!['PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  res.conflictCheck = () => false;

  const clientTimestamp = parseInt(req.headers['x-client-timestamp'], 10) ||
                          (req.body && !isNaN(parseInt(req.body?.clientTimestamp)) ? parseInt(req.body.clientTimestamp) : NaN);
  if (isNaN(clientTimestamp)) {
    return next();
  }

  req.clientTimestamp = clientTimestamp;

  if (req.body && req.body.clientTimestamp !== undefined) {
    delete req.body.clientTimestamp;
  }

  res.conflictCheck = (record) => {
    if (!record || !record.updated_at) return false;
    const serverTime = new Date(record.updated_at).getTime();
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
