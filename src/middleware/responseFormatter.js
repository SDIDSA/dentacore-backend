function formatResponse(data, meta) {
  const response = { data };
  if (meta) response.meta = meta;
  return response;
}

function responseFormatter(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (body && typeof body === 'object' && !body.error && !body.data && !body.message) {
      return originalJson(formatResponse(body));
    }
    return originalJson(body);
  };
  next();
}

module.exports = { responseFormatter, formatResponse };
