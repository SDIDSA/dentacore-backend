// Slot availability for the public booking portal.
//
// Availability = declared working_hours for the weekday, minus already-booked
// active appointments, minus slots that are in the past (with a 30-minute
// lead time when querying today).
//
// Timezone: Africa/Algiers is UTC+01 all year (no DST), so wall-clock time is
// derived by shifting instants a fixed +60 minutes and reading the UTC fields.

const { sql } = require('kysely');
const db = require('../config/database');

const BUSY_STATUSES = ['appt.status.cancelled', 'appt.status.no_show'];
const ALGIERS_OFFSET_MIN = 60;
const LEAD_TIME_MIN = 30;

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 'YYYY-MM-DD' -> JS day of week (0=Sunday..6=Saturday), independent of host TZ
function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// Current Algiers wall clock as { date: 'YYYY-MM-DD', minutes }
function algiersNow() {
  const shifted = new Date(Date.now() + ALGIERS_OFFSET_MIN * 60000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

// Instant (pg timestamp) -> Algiers minutes-since-midnight
function algiersMinutes(instant) {
  const shifted = new Date(instant.getTime() + ALGIERS_OFFSET_MIN * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/**
 * Free bookable slots for one clinic-day.
 * @returns [{ dentist_id, slot_minutes, slots: ['HH:MM', ...] }]
 */
async function getDayAvailability({ tenantId, date, dentistId = null }) {
  const dow = dayOfWeek(date);

  let whQuery = db
    .selectFrom('working_hours')
    .select(['dentist_id', 'start_time', 'end_time', 'slot_minutes'])
    .where('tenant_id', '=', tenantId)
    .where('day_of_week', '=', dow)
    .where('is_active', '=', true);
  if (dentistId) whQuery = whQuery.where('dentist_id', '=', dentistId);
  const windows = await whQuery.execute();
  if (!windows.length) return [];

  const dentistIds = [...new Set(windows.map((w) => w.dentist_id))];

  const booked = await db
    .selectFrom('appointments')
    .select(['dentist_id', 'appointment_date', 'duration_minutes'])
    .where('tenant_id', '=', tenantId)
    .where('status_key', 'not in', BUSY_STATUSES)
    .where('dentist_id', 'in', dentistIds)
    .where(sql`(appointment_date AT TIME ZONE 'Africa/Algiers')::date = ${date}`)
    .execute();

  // per-dentist busy minute ranges
  const busyByDentist = new Map();
  for (const b of booked) {
    if (!busyByDentist.has(b.dentist_id)) busyByDentist.set(b.dentist_id, []);
    busyByDentist.get(b.dentist_id).push({
      start: algiersMinutes(b.appointment_date),
      end: algiersMinutes(b.appointment_date) + Number(b.duration_minutes || 0),
    });
  }

  const now = algiersNow();
  const isToday = now.date === date;
  const earliest = isToday ? now.minutes + LEAD_TIME_MIN : -1;

  // group windows per dentist (a dentist may have several ranges per day)
  const perDentist = new Map();
  for (const w of windows) {
    if (!perDentist.has(w.dentist_id)) perDentist.set(w.dentist_id, []);
    perDentist.get(w.dentist_id).push(w);
  }

  const result = [];
  for (const [dentistId, ranges] of perDentist.entries()) {
    ranges.sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));
    const slotMinutes = Math.min(...ranges.map((r) => Number(r.slot_minutes)));
    const busy = busyByDentist.get(dentistId) || [];
    const slots = [];

    for (const r of ranges) {
      const startM = toMinutes(r.start_time);
      const endM = toMinutes(r.end_time);
      const step = Number(r.slot_minutes);
      for (let t = startM; t + step <= endM; t += step) {
        if (t < earliest) continue;
        const overlaps = busy.some((b) => t < b.end && b.start < t + step);
        if (!overlaps) slots.push(toHHMM(t));
      }
    }

    if (slots.length) result.push({ dentist_id: dentistId, slot_minutes: slotMinutes, slots });
  }

  result.sort((a, b) => a.slots[0].localeCompare(b.slots[0]));
  return result;
}

module.exports = { getDayAvailability, algiersNow, dayOfWeek };
