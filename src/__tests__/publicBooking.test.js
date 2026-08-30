// Public booking portal regression tests.
//
// Exercises the unauthenticated /api/v1/public/:clinic/* surface end-to-end:
// slug resolution, dentist/service listing, slot computation against seeded
// working_hours, guest booking (patient stub + appointment), staff visibility,
// the one-active-appointment-per-slot race guard, duplicate-phone guard and
// cross-tenant dentist rejection.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('../config/database');
const { loginAs } = require('./helpers/config');

function uuidv4() { return crypto.randomUUID(); }

let dbAvailable = true;
let ctx = null;

beforeAll(async () => {
  try {
    await db.selectFrom('tenants').select('id').limit(1).execute();

    const suffix = uuidv4().slice(0, 8);

    // --- prototype clinic ---
    const [tenant] = await db
      .insertInto('tenants')
      .values({
        name: `Portal Clinic ${suffix}`,
        subdomain: `portal-${suffix}`,
        subscription_status: 'tenant.status.trial',
      })
      .returningAll()
      .execute();

    const roles = await db.selectFrom('roles').select(['id', 'role_key']).execute();
    const roleId = Object.fromEntries(roles.map((r) => [r.role_key, r.id]));

    const password = 'Regress@2025!';
    const [dentist] = await db
      .insertInto('users')
      .values({
        tenant_id: tenant.id,
        email: `doc-${suffix}@test.dz`,
        password_hash: bcrypt.hashSync(password, 10),
        full_name: `Dr. Portal ${suffix}`,
        phone: `+213${String(Date.now()).slice(-9)}`,
      })
      .returning('id')
      .execute();
    await db.insertInto('user_roles').values({ user_id: dentist.id, role_id: roleId['auth.role.dentist'] }).execute();

    const [admin] = await db.insertInto('users').values({
      tenant_id: tenant.id,
      email: `admin-${suffix}@test.dz`,
      password_hash: bcrypt.hashSync(password, 10),
      full_name: `Portal Admin ${suffix}`,
      phone: `+213${String(Date.now() + 1).slice(-9)}`,
    }).returning('id').execute();
    await db.insertInto('user_roles').values({ user_id: admin.id, role_id: roleId['auth.role.admin'] }).execute();

    // working hours for TOMORROW (Algiers): 09:00-12:00, 30-min slots
    const day = new Date(Date.now() + 86400000 + 3600000); // +1d, shifted to Algiers
    const date = day.toISOString().slice(0, 10);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    await db
      .insertInto('working_hours')
      .values({
        tenant_id: tenant.id,
        dentist_id: dentist.id,
        day_of_week: dow,
        start_time: '09:00',
        end_time: '12:00',
        slot_minutes: 30,
      })
      .execute();

    // --- foreign clinic used for cross-tenant probes ---
    const [other] = await db
      .insertInto('tenants')
      .values({
        name: `Other Clinic ${suffix}`,
        subdomain: `other-${suffix}`,
        subscription_status: 'tenant.status.trial',
      })
      .returningAll()
      .execute();
    const [otherDentist] = await db
      .insertInto('users')
      .values({
        tenant_id: other.id,
        email: `other-doc-${suffix}@test.dz`,
        password_hash: bcrypt.hashSync(password, 10),
        full_name: `Dr. Foreign ${suffix}`,
        phone: `+213${String(Date.now() + 2).slice(-9)}`,
      })
      .returning('id')
      .execute();
    await db.insertInto('user_roles').values({ user_id: otherDentist.id, role_id: roleId['auth.role.dentist'] }).execute();

    ctx = {
      suffix,
      tenant,
      dentistId: dentist.id,
      otherTenant: other,
      otherDentistId: otherDentist.id,
      date,
      password,
      adminEmail: `admin-${suffix}@test.dz`,
    };
  } catch (err) {
    console.warn(`[publicBooking] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable || !ctx) return;
  try {
    await db.deleteFrom('tenants').where('id', 'in', [ctx.tenant.id, ctx.otherTenant.id]).execute();
  } catch (_) { /* ignore cleanup errors */ }
});

describe('Public booking portal', () => {
  const base = '/api/v1/public';

  it('404s an unknown clinic slug without leaking existence', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/no-such-clinic-zzz/dentists`);
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('public.clinic_not_found');
  });

  it('404s a malformed slug', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/BAD_SLASH/dentists`);
    expect(res.statusCode).toBe(404);
  });

  it('lists only this clinic\u2019s active dentists', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/${ctx.tenant.subdomain}/dentists`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((d) => d.full_name);
    expect(names.some((n) => n.includes(ctx.suffix))).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('Dr. Foreign');
  });

  it('lists bookable services', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get(`${base}/${ctx.tenant.subdomain}/services`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('computes free slots from working_hours', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .get(`${base}/${ctx.tenant.subdomain}/slots`)
      .query({ date: ctx.date });
    expect(res.statusCode).toBe(200);
    expect(res.body.date).toBe(ctx.date);
    const group = res.body.availability.find((g) => g.dentist_id === ctx.dentistId);
    expect(group).toBeTruthy();
    expect(group.slot_minutes).toBe(30);
    expect(group.slots.length).toBeGreaterThan(0);
    expect(group.slots[0]).toBe('09:00');
    expect(group.slots.every((s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s))).toBe(true);
    ctx.firstSlot = group.slots[0];
  });

  it('books a slot as a guest: patient stub + appointment visible to staff', async () => {
    if (!dbAvailable) return;
    const wallHour = Number(ctx.firstSlot.slice(0, 2));
    const when = `${ctx.date}T${String(wallHour - 1).padStart(2, '0')}:${ctx.firstSlot.slice(3)}:00.000Z`;

    const res = await request(app)
      .post(`${base}/${ctx.tenant.subdomain}/bookings`)
      .send({
        full_name: 'Guest Visitor',
        phone: '+213555000111',
        dentist_id: ctx.dentistId,
        appointment_date: when,
        notes: 'portal prototype booking',
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.patient_code).toMatch(/^PAT-\d{4}-\d{4}$/);
    expect(res.body.status_key).toBe('appt.status.scheduled');

    // staff-side visibility through the authenticated desktop API
    const token = await loginAs(app, ctx.adminEmail, ctx.password);
    const list = await request(app)
      .get('/api/v1/appointments')
      .set('Authorization', `Bearer ${token}`);
    expect(list.statusCode).toBe(200);
    // param-less list returns bare id arrays (JavaFX client contract)
    const ids = Array.isArray(list.body) ? list.body : [];
    expect(ids).toContain(res.body.id);

    ctx.bookedWhen = when;
  });

  it('rejects a second guest grabbing the same slot (race guard)', async () => {
    if (!dbAvailable || !ctx.bookedWhen) return;
    const res = await request(app)
      .post(`${base}/${ctx.tenant.subdomain}/bookings`)
      .send({
        full_name: 'Second Guest',
        phone: '+213555000222',
        dentist_id: ctx.dentistId,
        appointment_date: ctx.bookedWhen,
      });
    expect([409]).toContain(res.statusCode);
    expect(['public.booking.slot_taken', 'public.booking.slot_unavailable']).toContain(res.body.error);
  });

  it('caps one upcoming booking per phone number', async () => {
    if (!dbAvailable || !ctx.bookedWhen) return;
    // grab another free slot first (any remaining), then a third attempt with phone #1
    const slotsRes = await request(app)
      .get(`${base}/${ctx.tenant.subdomain}/slots`)
      .query({ date: ctx.date, dentist_id: ctx.dentistId });
    const group = slotsRes.body.availability.find((g) => g.dentist_id === ctx.dentistId);
    if (!group || group.slots.length < 2) return; // nothing left to prove with

    const takenWall = Number(ctx.bookedWhen.slice(11, 13)) + 1;
    const takenSlot = `${String(takenWall).padStart(2, '0')}:${ctx.bookedWhen.slice(14, 16)}`;
    const nextSlot = group.slots.find((s) => s !== takenSlot);
    if (!nextSlot) return;

    const when = `${ctx.date}T${String(Number(nextSlot.slice(0, 2)) - 1).padStart(2, '0')}:${nextSlot.slice(3)}:00.000Z`;
    const res = await request(app)
      .post(`${base}/${ctx.tenant.subdomain}/bookings`)
      .send({
        full_name: 'Guest Visitor Again',
        phone: '+213555000111', // already has an upcoming booking
        dentist_id: ctx.dentistId,
        appointment_date: when,
      });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe('public.booking.limit_reached');
  });

  it('rejects a foreign-clinic dentist without leaking the other tenant', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post(`${base}/${ctx.tenant.subdomain}/bookings`)
      .send({
        full_name: 'Cross Tenant Probe',
        phone: '+213555000333',
        dentist_id: ctx.otherDentistId,
        appointment_date: `${ctx.date}T08:00:00.000Z`,
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('public.booking.dentist_unavailable');
    expect(JSON.stringify(res.body)).not.toContain('Other Clinic');
  });

  it('validates phone format', async () => {
    if (!dbAvailable) return;
    const res = await request(app)
      .post(`${base}/${ctx.tenant.subdomain}/bookings`)
      .send({
        full_name: 'Bad Phone',
        phone: '0555000111',
        dentist_id: ctx.dentistId,
        appointment_date: `${ctx.date}T08:00:00.000Z`,
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('validation.error');
  });
});
