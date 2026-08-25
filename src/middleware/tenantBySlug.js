// Public booking routes carry no JWT: the clinic is identified by its
// subdomain slug in the URL (/api/v1/public/:clinic/...).
//
// Unknown slug, malformed slug and every other "which clinic is this" failure
// answer with the SAME generic 404 so the clinic namespace can't be probed.
const db = require('../config/database');

// Mirrors chk_subdomain_format on tenants.subdomain
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

async function tenantBySlug(req, res, next) {
  try {
    const slug = String(req.params.clinic || '').toLowerCase();
    if (!SLUG_RE.test(slug)) {
      return res.status(404).json({ error: 'public.clinic_not_found' });
    }
    const tenant = await db
      .selectFrom('tenants')
      .select(['id', 'name', 'subdomain'])
      .where('subdomain', '=', slug)
      .executeTakeFirst();
    if (!tenant) {
      return res.status(404).json({ error: 'public.clinic_not_found' });
    }
    req.tenantId = tenant.id;
    req.tenant = tenant;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { tenantBySlug };
