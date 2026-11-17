// Clinic self-service: profile, weekly opening hours (-> booking portal slots,
// dentist sync on create/role change) and the self-service password change.
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const request = require('supertest');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('../config/database');
const { loginAs } = require('./helpers/config');

let dbAvailable = true;
let ctx = null;

// tomorrow's date + weekday in Algiers wall-clock terms (UTC+1, no DST)
function tomorrow() {
  const date = new Date(Date.now() + 86400000 + 3600000).toISOString().slice(0, 10);
  return { date, dow: new Date(`${date}T00:00:00Z`).getUTCDay() };
}

beforeAll(async () => {
  try {
    await db.selectFrom('tenants').select('id').limit(1).execute();
    const suffix = crypto.randomUUID().slice(0, 8);
    const [tenant] = await db.insertInto('tenants')
      .values({ name: `Clinic ${suffix}`, subdomain: `clinic-${suffix}`, subscription_status: 'tenant.status.trial' })
      .returningAll().execute();
    const roles = await db.selectFrom('roles').select(['id', 'role_key']).execute();
    const roleId = Object.fromEntries(roles.map((r) => [r.role_key, r.id]));
    const password = 'Clinic@2025!';
    const mk = async (tag, roleKey, n) => {
      const [u] = await db.insertInto('users').values({
        tenant_id: tenant.id,
        email: `${tag}-${suffix}@test.dz`,
        password_hash: bcrypt.hashSync(password, 10),
        full_name: `${tag} ${suffix}`,
        phone: `+213${String(Date.now() + n).slice(-9)}`,
      }).returning('id').execute();
      await db.insertInto('user_roles').values({ user_id: u.id, role_id: roleId[roleKey] }).execute();
      return { id: u.id, email: `${tag}-${suffix}@test.dz` };
    };
    const admin = await mk('admin', 'auth.role.admin', 11);
    const dentist = await mk('doc', 'auth.role.dentist', 12);
    const recep = await mk('recep', 'auth.role.receptionist', 13);
    ctx = {
      suffix, tenant, admin, dentist, recep, password, roleId,
      adminToken: await loginAs(app, admin.email, password),
      recepToken: await loginAs(app, recep.email, password),
    };
  } catch (err) {
    console.warn(`[clinic] DB unavailable or setup failed, skipping suite: ${err.message}`);
    dbAvailable = false;
  }
});

afterAll(async () => {
  if (!dbAvailable || !ctx) return;
  try {
    // appointments.dentist_id is ON DELETE RESTRICT: clear them before the tenant cascade
    await db.deleteFrom('notifications').where('tenant_id', '=', ctx.tenant.id).execute();
    await db.deleteFrom('appointments').where('tenant_id', '=', ctx.tenant.id).execute();
    await db.deleteFrom('tenants').where('id', '=', ctx.tenant.id).execute();
  } catch (_) { /* ignore cleanup errors */ }
});

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('Clinic profile', () => {
  it('returns the caller\'s own clinic to any staff member', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/clinic').set(auth(ctx.recepToken));
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(ctx.tenant.id);
    expect(res.body.name).toBe(ctx.tenant.name);
    expect(res.body).toHaveProperty('address', null);
  });

  it('lets an admin update name/address/phone/email', async () => {
    if (!dbAvailable) return;
    const res = await request(app).patch('/api/v1/clinic').set(auth(ctx.adminToken))
      .send({ name: `Renamed ${ctx.suffix}`, address: '12 Rue Didouche, Alger', phone: '+213555000111', email: 'contact@clinic.dz' });
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe(`Renamed ${ctx.suffix}`);
    expect(res.body.address).toBe('12 Rue Didouche, Alger');
    const again = await request(app).get('/api/v1/clinic').set(auth(ctx.recepToken));
    expect(again.body.email).toBe('contact@clinic.dz');
    // partial update keeps the other profile fields
    const partial = await request(app).patch('/api/v1/clinic').set(auth(ctx.adminToken)).send({ phone: '+213555000222' });
    expect(partial.body.address).toBe('12 Rue Didouche, Alger');
    expect(partial.body.phone).toBe('+213555000222');
  });

  it('rejects non-admins and invalid input', async () => {
    if (!dbAvailable) return;
    const forbidden = await request(app).patch('/api/v1/clinic').set(auth(ctx.recepToken)).send({ name: 'Nope' });
    expect(forbidden.statusCode).toBe(403);
    const bad = await request(app).patch('/api/v1/clinic').set(auth(ctx.adminToken)).send({ email: 'not-an-email' });
    expect(bad.statusCode).toBe(400);
  });
});

describe('Clinic working hours', () => {
  it('defaults to every day but Friday, 08:00-17:00', async () => {
    if (!dbAvailable) return;
    const res = await request(app).get('/api/v1/clinic/working-hours').set(auth(ctx.recepToken));
    expect(res.statusCode).toBe(200);
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days.find((d) => d.day_of_week === 5).enabled).toBe(false);
    expect(res.body.days.find((d) => d.day_of_week === 0)).toMatchObject({ enabled: true, start: '08:00', end: '17:00' });
  });

  it('PUT drives the public portal slots for every dentist', async () => {
    if (!dbAvailable) return;
    const { date, dow } = tomorrow();
    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ day_of_week: d, enabled: d === dow, start: '10:00', end: '12:00' }));
    const put = await request(app).put('/api/v1/clinic/working-hours').set(auth(ctx.adminToken))
      .send({ slot_minutes: 30, days });
    expect(put.statusCode).toBe(200);
    expect(put.body.dentists_updated).toBe(1);

    const slots = await request(app).get(`/api/v1/public/${ctx.tenant.subdomain}/slots`).query({ date });
    expect(slots.statusCode).toBe(200);
    const group = slots.body.availability.find((g) => g.dentist_id === ctx.dentist.id);
    expect(group).toBeTruthy();
    expect(group.slots).toEqual(['10:00', '10:30', '11:00', '11:30']);

    const got = await request(app).get('/api/v1/clinic/working-hours').set(auth(ctx.recepToken));
    expect(got.body.days.find((d) => d.day_of_week === dow)).toMatchObject({ enabled: true, start: '10:00', end: '12:00' });
  });

  it('gives a newly created dentist the clinic hours and drops them when the role goes', async () => {
    if (!dbAvailable) return;
    const created = await request(app).post('/api/v1/users').set(auth(ctx.adminToken)).send({
      email: `newdoc-${ctx.suffix}@test.dz`, password: 'NewDoc@2025!', full_name: `New Doc ${ctx.suffix}`,
      phone: `+213${String(Date.now() + 99).slice(-9)}`, role_ids: [ctx.roleId['auth.role.dentist']],
    });
    expect(created.statusCode).toBe(201);
    const rows = await db.selectFrom('working_hours').selectAll().where('dentist_id', '=', created.body.id).execute();
    expect(rows).toHaveLength(1);
    expect(rows[0].start_time.slice(0, 5)).toBe('10:00');

    const demoted = await request(app).patch(`/api/v1/users/${created.body.id}`).set(auth(ctx.adminToken))
      .send({ role_ids: [ctx.roleId['auth.role.receptionist']] });
    expect(demoted.statusCode).toBe(200);
    const after = await db.selectFrom('working_hours').select('id').where('dentist_id', '=', created.body.id).execute();
    expect(after).toHaveLength(0);
  });

  it('rejects non-admins and invalid schedules', async () => {
    if (!dbAvailable) return;
    const days = [{ day_of_week: 1, enabled: true, start: '12:00', end: '09:00' }];
    const forbidden = await request(app).put('/api/v1/clinic/working-hours').set(auth(ctx.recepToken)).send({ days });
    expect(forbidden.statusCode).toBe(403);
    const inverted = await request(app).put('/api/v1/clinic/working-hours').set(auth(ctx.adminToken)).send({ days });
    expect(inverted.statusCode).toBe(400);
    const badSlot = await request(app).put('/api/v1/clinic/working-hours').set(auth(ctx.adminToken))
      .send({ slot_minutes: 5, days: [{ day_of_week: 1, enabled: true, start: '09:00', end: '12:00' }] });
    expect(badSlot.statusCode).toBe(400);
  });
});

describe('Self-service password change', () => {
  it('lets a non-admin change their own password with the current one', async () => {
    if (!dbAvailable) return;
    const wrong = await request(app).patch('/api/v1/auth/password').set(auth(ctx.recepToken))
      .send({ current_password: 'nope-nope', new_password: 'Changed@2025!' });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.body.error).toBe('auth.error.wrong_current_password');

    const same = await request(app).patch('/api/v1/auth/password').set(auth(ctx.recepToken))
      .send({ current_password: ctx.password, new_password: ctx.password });
    expect(same.body.error).toBe('auth.error.password_unchanged');

    const ok = await request(app).patch('/api/v1/auth/password').set(auth(ctx.recepToken))
      .send({ current_password: ctx.password, new_password: 'Changed@2025!' });
    expect(ok.statusCode).toBe(204);
    await expect(loginAs(app, ctx.recep.email, 'Changed@2025!')).resolves.toBeTruthy();
  });

  it('requires authentication and a long enough new password', async () => {
    if (!dbAvailable) return;
    const anon = await request(app).patch('/api/v1/auth/password').send({ current_password: 'x', new_password: 'Whatever@2025!' });
    expect(anon.statusCode).toBe(401);
    const short = await request(app).patch('/api/v1/auth/password').set(auth(ctx.adminToken))
      .send({ current_password: ctx.password, new_password: 'short' });
    expect(short.statusCode).toBe(400);
  });
});

describe('Notification type mutes', () => {
  it('drops excluded types from the list and the unread badge', async () => {
    if (!dbAvailable) return;
    await db.insertInto('notifications').values({
      tenant_id: ctx.tenant.id, type: 'low_stock', channel: 'in_app',
      title: 'Alerte stock faible', message: 'test', status: 'unread', created_at: new Date(),
    }).execute();

    const all = await request(app).get('/api/v1/notifications').set(auth(ctx.adminToken));
    expect(all.body.some((n) => n.type === 'low_stock')).toBe(true);
    const badge = await request(app).get('/api/v1/notifications/unread-count').set(auth(ctx.adminToken));
    expect(badge.body.count).toBeGreaterThanOrEqual(1);

    const muted = await request(app).get('/api/v1/notifications')
      .query({ exclude_types: 'low_stock,reminder' }).set(auth(ctx.adminToken));
    expect(muted.body.some((n) => n.type === 'low_stock')).toBe(false);
    const mutedBadge = await request(app).get('/api/v1/notifications/unread-count')
      .query({ exclude_types: 'low_stock' }).set(auth(ctx.adminToken));
    expect(mutedBadge.body.count).toBe(0);

    // junk in the list is ignored, not injected
    const junk = await request(app).get('/api/v1/notifications')
      .query({ exclude_types: "x'); DROP TABLE users;--" }).set(auth(ctx.adminToken));
    expect(junk.statusCode).toBe(200);
  });
});

describe('Appointment reminders', () => {
  it('records an undeliverable reminder as failed, never as sent, and does not retry it', async () => {
    if (!dbAvailable) return;
    const { checkUpcomingAppointments } = require('../services/notificationService');
    const savedSmtp = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST; // never send real mail from tests
    try {
      const [patient] = await db.insertInto('patients').values({
        tenant_id: ctx.tenant.id,
        patient_code: `R${ctx.suffix}`.slice(0, 20),
        full_name: `Reminder Patient ${ctx.suffix}`,
        phone: `+213${String(Date.now() + 77).slice(-9)}`,
        email: `patient-${ctx.suffix}@test.dz`,
      }).returning('id').execute();
      const [appt] = await db.insertInto('appointments').values({
        tenant_id: ctx.tenant.id,
        patient_id: patient.id,
        dentist_id: ctx.dentist.id,
        appointment_date: new Date(Date.now() + 3 * 3600000),
        status_key: 'appt.status.scheduled',
      }).returning('id').execute();

      const sent = await checkUpcomingAppointments(ctx.tenant.id);
      expect(sent.find((s) => s.appointmentId === appt.id)).toBeUndefined();

      const rows = await db.selectFrom('notifications').selectAll()
        .where('appointment_id', '=', appt.id).execute();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: 'reminder', channel: 'email', status: 'failed' });
      expect(rows[0].sent_at).toBeNull();

      await checkUpcomingAppointments(ctx.tenant.id);
      const again = await db.selectFrom('notifications').select('id')
        .where('appointment_id', '=', appt.id).execute();
      expect(again).toHaveLength(1);
    } finally {
      if (savedSmtp !== undefined) process.env.SMTP_HOST = savedSmtp;
    }
  });
});
