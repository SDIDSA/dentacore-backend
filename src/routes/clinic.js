// The signed-in user's own clinic (tenant): profile + weekly opening hours.
//
//   GET   /api/v1/clinic                 profile (any staff member)
//   PATCH /api/v1/clinic                 update name/address/phone/email (admin)
//   GET   /api/v1/clinic/working-hours   weekly hours (any staff member)
//   PUT   /api/v1/clinic/working-hours   replace weekly hours (admin) -> regenerates every
//                                        active dentist's working_hours rows (booking portal slots)
//
// Profile fields other than `name` live in tenants.settings.profile; hours in
// tenants.settings.working_hours (see utils/clinicHours.js).

const express = require('express');
const { body, validationResult } = require('express-validator');
const { sql } = require('kysely');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../config/database');
const { normalizeHours, getClinicHours, applyClinicHours } = require('../utils/clinicHours');

const router = express.Router();
router.use(authenticate);

const PROFILE_FIELDS = ['address', 'phone', 'email'];

async function loadProfile(tenantId) {
  const t = await db
    .selectFrom('tenants')
    .select(['id', 'name', 'subdomain', 'logo_url', 'settings'])
    .where('id', '=', tenantId)
    .executeTakeFirst();
  if (!t) return null;
  const p = (t.settings && t.settings.profile) || {};
  return {
    id: t.id,
    name: t.name,
    subdomain: t.subdomain,
    logo_url: t.logo_url,
    address: p.address ?? null,
    phone: p.phone ?? null,
    email: p.email ?? null,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const profile = await loadProfile(req.tenantId);
    if (!profile) return res.status(404).json({ error: 'clinic.error.not_found' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.patch('/',
  authorize('auth.role.admin'),
  body('name').optional().isString().trim().isLength({ min: 2, max: 255 }),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^\+?[0-9 ]{6,20}$/),
  body('email').optional({ nullable: true, checkFalsy: true }).isEmail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'validation.error', details: errors.array() });
    }
    try {
      const before = await loadProfile(req.tenantId);
      if (!before) return res.status(404).json({ error: 'clinic.error.not_found' });

      const profilePatch = {};
      for (const f of PROFILE_FIELDS) {
        if (req.body[f] !== undefined) profilePatch[f] = req.body[f] === '' ? null : req.body[f];
      }
      const set = { updated_at: new Date() };
      if (req.body.name !== undefined) set.name = req.body.name;
      if (Object.keys(profilePatch).length) {
        set.settings = sql`COALESCE(settings, '{}'::jsonb) || jsonb_build_object('profile',
          COALESCE(settings->'profile', '{}'::jsonb) || ${JSON.stringify(profilePatch)}::jsonb)`;
      }
      await db.updateTable('tenants').set(set).where('id', '=', req.tenantId).execute();

      const after = await loadProfile(req.tenantId);
      if (req.audit) {
        await req.audit.log({
          action: 'UPDATE', entityType: 'tenants', entityId: req.tenantId, tenantId: req.tenantId,
          oldValues: before, newValues: after,
        }, db);
      }
      res.json(after);
    } catch (err) {
      next(err);
    }
  }
);

router.get('/working-hours', async (req, res, next) => {
  try {
    res.json(await getClinicHours(db, req.tenantId));
  } catch (err) {
    next(err);
  }
});

router.put('/working-hours', authorize('auth.role.admin'), async (req, res, next) => {
  const { value, error } = normalizeHours(req.body);
  if (error) return res.status(400).json({ error });
  try {
    const before = await getClinicHours(db, req.tenantId);
    const dentists = await db.transaction().execute((trx) => applyClinicHours(trx, req.tenantId, value));
    if (req.audit) {
      await req.audit.log({
        action: 'UPDATE', entityType: 'working_hours', entityId: req.tenantId, tenantId: req.tenantId,
        oldValues: before, newValues: value,
      }, db);
    }
    res.json({ ...value, dentists_updated: dentists });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
