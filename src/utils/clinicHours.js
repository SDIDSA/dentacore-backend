// Clinic-wide weekly opening hours.
//
// SSOT: tenants.settings.working_hours = { slot_minutes, days: [{ day_of_week, enabled, start, end }] }
// (day_of_week uses the JS getDay() convention, 0=Sunday .. 6=Saturday, same as working_hours).
// The per-dentist `working_hours` rows that drive the public booking portal's slots are
// DERIVED from it: every active dentist of the tenant gets one row per enabled day.
// `applyClinicHours` rewrites all rows after an edit; `syncDentistHours` keeps a single
// user in step when they gain/lose the dentist role or are (de)activated.

const { sql } = require('kysely');

// Matches the desktop client's defaults (LocalStore): every day except Friday, 08:00-17:00.
const DEFAULT_HOURS = Object.freeze({
  slot_minutes: 30,
  days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    day_of_week: d,
    enabled: d !== 5,
    start: '08:00',
    end: '17:00',
  })),
});

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Validates + normalizes a client payload. Returns { value } or { error }. */
function normalizeHours(input) {
  if (!input || !Array.isArray(input.days)) return { error: 'clinic.error.invalid_hours' };
  const slot = input.slot_minutes === undefined ? 30 : Number(input.slot_minutes);
  if (!Number.isInteger(slot) || slot < 10 || slot > 120) return { error: 'clinic.error.invalid_slot' };
  const byDay = new Map();
  for (const d of input.days) {
    const dow = Number(d?.day_of_week);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6 || byDay.has(dow)) return { error: 'clinic.error.invalid_hours' };
    const enabled = d.enabled === true;
    const start = String(d.start || '').slice(0, 5);
    const end = String(d.end || '').slice(0, 5);
    if (enabled && (!HHMM.test(start) || !HHMM.test(end) || toMinutes(start) >= toMinutes(end))) {
      return { error: 'clinic.error.invalid_hours' };
    }
    byDay.set(dow, {
      day_of_week: dow,
      enabled,
      start: HHMM.test(start) ? start : '08:00',
      end: HHMM.test(end) ? end : '17:00',
    });
  }
  const days = [0, 1, 2, 3, 4, 5, 6].map((d) => byDay.get(d) || { ...DEFAULT_HOURS.days[d], enabled: false });
  return { value: { slot_minutes: slot, days } };
}

async function getClinicHours(dbOrTrx, tenantId) {
  const row = await dbOrTrx
    .selectFrom('tenants')
    .select('settings')
    .where('id', '=', tenantId)
    .executeTakeFirst();
  const stored = row?.settings?.working_hours;
  if (stored && Array.isArray(stored.days)) {
    const { value } = normalizeHours(stored);
    if (value) return value;
  }
  // Never configured through the API (e.g. seeded/demo tenants): reflect the existing
  // per-dentist rows (earliest start / latest end per weekday) so GET shows what the
  // portal actually offers; fall back to the defaults when there are none.
  const rows = await dbOrTrx
    .selectFrom('working_hours')
    .select([
      'day_of_week',
      sql`to_char(MIN(start_time), 'HH24:MI')`.as('start'),
      sql`to_char(MAX(end_time), 'HH24:MI')`.as('end'),
      sql`MIN(slot_minutes)`.as('slot_minutes'),
    ])
    .where('tenant_id', '=', tenantId)
    .where('is_active', '=', true)
    .groupBy('day_of_week')
    .execute();
  if (!rows.length) return DEFAULT_HOURS;
  const byDay = new Map(rows.map((r) => [Number(r.day_of_week), r]));
  return {
    slot_minutes: Number(rows[0].slot_minutes) || 30,
    days: [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const r = byDay.get(d);
      return r
        ? { day_of_week: d, enabled: true, start: r.start, end: r.end }
        : { ...DEFAULT_HOURS.days[d], enabled: false };
    }),
  };
}

function isActiveDentist(userIdRef) {
  return sql`EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = ${userIdRef} AND r.role_key = 'auth.role.dentist')`;
}

function rowsFor(tenantId, dentistId, hours) {
  return hours.days
    .filter((d) => d.enabled)
    .map((d) => ({
      tenant_id: tenantId,
      dentist_id: dentistId,
      day_of_week: d.day_of_week,
      start_time: d.start,
      end_time: d.end,
      slot_minutes: hours.slot_minutes,
      is_active: true,
    }));
}

/** Persists the clinic hours and regenerates every active dentist's working_hours rows. */
async function applyClinicHours(trx, tenantId, hours) {
  await trx
    .updateTable('tenants')
    .set({
      settings: sql`COALESCE(settings, '{}'::jsonb) || jsonb_build_object('working_hours', ${JSON.stringify(hours)}::jsonb)`,
      updated_at: new Date(),
    })
    .where('id', '=', tenantId)
    .execute();

  await trx.deleteFrom('working_hours').where('tenant_id', '=', tenantId).execute();

  const dentists = await trx
    .selectFrom('users')
    .select('id')
    .where('tenant_id', '=', tenantId)
    .where('status_key', '=', 'user.status.active')
    .where(isActiveDentist(sql.ref('users.id')))
    .execute();

  const rows = dentists.flatMap((u) => rowsFor(tenantId, u.id, hours));
  if (rows.length) await trx.insertInto('working_hours').values(rows).execute();
  return dentists.length;
}

/**
 * Keeps one user's working_hours in step with their role/status: an active dentist with no
 * rows gets the clinic hours; anyone else (not a dentist, or inactive) loses theirs.
 */
async function syncDentistHours(dbOrTrx, tenantId, userId) {
  const user = await dbOrTrx
    .selectFrom('users')
    .select(['id', 'status_key', isActiveDentist(sql.ref('users.id')).as('is_dentist')])
    .where('id', '=', userId)
    .where('tenant_id', '=', tenantId)
    .executeTakeFirst();
  if (!user) return;

  if (!user.is_dentist || user.status_key !== 'user.status.active') {
    await dbOrTrx.deleteFrom('working_hours').where('dentist_id', '=', userId).execute();
    return;
  }
  const existing = await dbOrTrx
    .selectFrom('working_hours')
    .select('id')
    .where('dentist_id', '=', userId)
    .executeTakeFirst();
  if (existing) return;
  const rows = rowsFor(tenantId, userId, await getClinicHours(dbOrTrx, tenantId));
  if (rows.length) await dbOrTrx.insertInto('working_hours').values(rows).execute();
}

module.exports = { DEFAULT_HOURS, normalizeHours, getClinicHours, applyClinicHours, syncDentistHours };
