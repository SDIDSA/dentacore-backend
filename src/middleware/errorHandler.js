const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'validation.error',
      details: err.details,
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'error.duplicate_entry' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'error.foreign_key_violation' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'error.internal_server',
  });
};

module.exports = errorHandler;
