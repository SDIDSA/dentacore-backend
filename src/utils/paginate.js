function parsePagination(req) {
  const hasLimit = req.query.limit !== undefined;
  if (!hasLimit) {
    return { paginate: false };
  }
  const limit = parseInt(req.query.limit);
  const offset = parseInt(req.query.offset) || 0;

  if (isNaN(limit) || limit < 0) {
    throw Object.assign(new Error('pagination.error.invalid_limit'), { status: 400 });
  }
  if (isNaN(offset) || offset < 0) {
    throw Object.assign(new Error('pagination.error.invalid_offset'), { status: 400 });
  }

  return { paginate: true, limit: Math.min(limit, 200), offset };
}

function wrapPaginatedResponse(ids, total, limit, offset) {
  return { data: ids, total, limit, offset };
}

module.exports = { parsePagination, wrapPaginatedResponse };
