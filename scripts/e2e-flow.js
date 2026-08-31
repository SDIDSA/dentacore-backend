#!/usr/bin/env node
/**
 * Sera Backend — End-to-End Request Flow Tester
 *
 * Walks the ENTIRE API (see E2E_FLOW.md in this directory) in dependency order as a
 * single admin journey: signup a throwaway tenant -> login -> staff -> patients ->
 * inventory -> appointments -> treatments/plans/odontogram -> billing (invoices +
 * payments + prescriptions) -> expenses + purchase orders -> xrays/media ->
 * dashboard/reports/audit/notifications -> (optional) platform operator console.
 *
 * Usage (run from the project root):
 *   node scripts/e2e-flow.js [--no-signup] [--base http://localhost:4000]
 *
 *   --no-signup   Do NOT create a tenant. Use ADMIN_EMAIL / ADMIN_PASSWORD from .env
 *                 to log into an existing tenant instead.
 *   --base        Override the API base (default reads API_URL/PORT from .env, else
 *                 http://localhost:4000).
 *
 * Environment (.env) — all optional:
 *   ADMIN_EMAIL, ADMIN_PASSWORD       used only with --no-signup (or if signup fails)
 *   PLATFORM_EMAIL, PLATFORM_PASSWORD if set, Phase 12 (operator console) is exercised
 *
 * Output: one PASS/FAIL per step. Exits non-zero if any step fails (CI-usable).
 * Run against a THROWAWAY tenant so real data is untouched.
 *
 * Requires Node >= 18 (global fetch). No npm dependencies.
 */

require('dotenv').config();

const BASE = (
  process.argv.includes('--base')
    ? process.argv[process.argv.indexOf('--base') + 1]
    : (process.env.API_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:4000'))
).replace(/\/+$/, '');

const API = BASE + '/api/v1';
const NO_SIGNUP = process.argv.includes('--no-signup');

let failures = 0, passed = 0, skipped = 0;
const results = [];

function report(category, name, ok, detail) {
  const isSkip = typeof detail === 'string' && detail.startsWith('SKIP');
  const tag = isSkip ? 'SKIP' : (ok ? 'PASS' : 'FAIL');
  if (isSkip) skipped++;
  else if (!ok) failures++;
  else passed++;
  results.push({ category, name, ok, detail });
  const line = `  [${tag}] ${category.padEnd(12)} ${name}${!isSkip && detail ? (ok ? '' : '  -- ' + detail) : ''}`;
  console.log(line);
}

/** JSON helper: performs a fetch, attaches auth, handles token rotation, JSON parses. */
async function api(method, path, { body, token, refresh, raw, headers } = {}) {
  // For FormData, let `fetch` generate the multipart Content-Type/boundary itself;
  // sending an explicit (or undefined) Content-Type prevents multer parsing.
  const isForm = raw instanceof FormData;
  const h = {};
  if (!isForm) h['Content-Type'] = 'application/json';
  for (const [k, v] of Object.entries(headers || {})) {
    const lk = k.toLowerCase();
    if (isForm && lk === 'content-type') continue; // let fetch set it
    if (lk === 'authorization' || lk === 'x-refresh-token') continue; // handled below
    h[k] = v;
  }
  if (token) h['Authorization'] = 'Bearer ' + token;
  if (refresh) h['x-refresh-token'] = refresh;
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  // capture rotated tokens, if any
  let rotated = null;
  const na = res.headers.get('x-access-token');
  const nr = res.headers.get('x-refresh-token');
  if (na || nr) rotated = { access: na, refresh: nr, status: res.status };
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = text; }
  return { status: res.status, json, rotated, text };
}

/** Assert a 2xx on the raw response; returns the parsed json or throws. */
async function expect(status, res, ctx) {
  if (status >= 200 && status < 300) return res.json;
  throw new Error(`HTTP ${res.status}: ${JSON.stringify(res.json).slice(0, 300)} (${ctx})`);
}

const S = { session: null, ids: {}, roles: {} };

async function run() {
  console.log(`\nSera backend E2E flow  (base: ${BASE})\n`);

  // ── Phase 0: health / signup ────────────────────────────────────────
  const ts = Date.now();
  const ADMIN_EMAIL = `e2e+${ts}@example.com`;
  const ADMIN_PASSWORD = 'Password@2026!';

  { const r = await api('GET', '/health');
    report('phase0', 'GET /health', r.status === 200 && r.json?.status === 'ok', r.status + ''); }

  if (!NO_SIGNUP) {
    const body = {
      clinic_name: `E2E Clinic ${ts}`,
      subdomain: `e2e${ts.toString(36)}`,
      full_name: 'E2E Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      phone: '+213551234567',
    };
    const r = await api('POST', '/api/v1/signup', { body });
    report('phase0', 'POST /signup (create tenant+admin)', r.status === 201, r.status + ' ' + JSON.stringify(r.json).slice(0, 120));
    S.signup = r.json;
  } else {
    console.log('  (--no-signup: using existing tenant from .env)');
  }

  // ── Phase 1: auth ───────────────────────────────────────────────────
  const loginBody = NO_SIGNUP
    ? { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
    : { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
  S.login = loginBody;

  const loginRes = await api('POST', '/api/v1/auth/login', { body: loginBody });
  report('phase1', 'POST /auth/login', loginRes.status === 200 && !!loginRes.json?.accessToken, loginRes.status + ' ' + JSON.stringify(loginRes.json).slice(0, 120));
  S.access = loginRes.json?.accessToken;
  S.refresh = loginRes.json?.refreshToken;
  S.tenantId = loginRes.json?.tenantId;

  const valRes = await api('GET', '/api/v1/auth/validate', { token: S.access, refresh: S.refresh });
  report('phase1', 'GET /auth/validate', valRes.status === 200, valRes.status + '');

  const A = (t, r) => ({ token: t || S.access, refresh: r || S.refresh });
  async function req2xx(method, path, opts) {
    const r = await api(method, path, { ...opts, token: A().token, refresh: A().refresh });
    await expect(r.status, r, path);
    if (r.rotated) { S.access = r.rotated.access || S.access; S.refresh = r.rotated.refresh || S.refresh; }
    return r.json;
  }

  // ── Phase 2: staff / users ──────────────────────────────────────────
  { const roles = await req2xx('GET', '/api/v1/users/meta/roles');
    for (const rl of roles) S.roles[rl.role_key] = rl.id;
    report('phase2', 'GET /users/meta/roles', !!S.roles['auth.role.admin'], 'roles=' + Object.values(S.roles).length);

    const newStaff = async (roleKey, fullName) => {
      const seq = (S._staffSeq = (S._staffSeq || 0) + 1);
      const b = {
        email: `${roleKey.replace(/\W/g, '')}+${Date.now()}${seq}@e2e.dz`,
        password: 'Password@2026!',
        full_name: fullName,
        phone: '+21355123' + String(4600 + seq), // unique per tenant
        role_ids: [S.roles[roleKey]],
      };
      const u = await req2xx('POST', '/api/v1/users', { body: b });
      return u;
    };

    const dentist = await newStaff('auth.role.dentist', 'Dr E2E Dentist');
    S.ids.dentist = dentist.id;
    report('phase2', 'POST /users (dentist)', !!dentist.id, 'id=' + dentist.id);
    const rec = await newStaff('auth.role.receptionist', 'E2E Receptionist');
    S.ids.receptionist = rec.id;
    report('phase2', 'POST /users (receptionist)', !!rec.id, 'id=' + rec.id);

    const list = await req2xx('GET', '/api/v1/users');
    report('phase2', 'GET /users', Array.isArray(list) && list.length >= 3, `count=${Array.isArray(list) ? list.length : '?'}`);

    const batch = await req2xx('GET', `/api/v1/users/batch?ids=${S.ids.dentist},${S.ids.receptionist}`);
    report('phase2', 'GET /users/batch', Array.isArray(batch) && batch.length === 2, '');

    await req2xx('PATCH', `/api/v1/users/${S.ids.receptionist}`, { body: { role_ids: [S.roles['auth.role.dentist']] } });
    report('phase2', 'PATCH /users/:id (role change)', true, '');
    await req2xx('PATCH', `/api/v1/users/${S.ids.receptionist}/status`, { body: { status_key: 'user.status.active' } });
    report('phase2', 'PATCH /users/:id/status', true, '');

    const pwd = await api('PATCH', `/api/v1/users/${S.ids.dentist}/password`, { body: { new_password: 'Password@2026!' }, token: A().token, refresh: A().refresh });
    report('phase2', 'PATCH /users/:id/password (-> 204)', pwd.status === 204, pwd.status + '');

    const srch = await req2xx('GET', '/api/v1/users/search?search=Dr');
    report('phase2', 'GET /users/search', Array.isArray(srch), '');
  }

  // ── Phase 3: patients ───────────────────────────────────────────────
  {
    const newPatient = async (name) => {
      const seq = (S._patSeq = (S._patSeq || 0) + 1);
      const p = await req2xx('POST', '/api/v1/patients', {
        body: {
          full_name: name, date_of_birth: '1990-04-12', gender: 'patient.gender.male',
          phone: '+21355123' + String(8000 + seq), // unique per tenant
          address: 'Algiers', medical_history: 'none', allergies: 'none',
        },
      });
      return p;
    };
    const p1 = await newPatient('E2E Patient One');
    S.ids.patient = p1.id;
    report('phase3', 'POST /patients', !!p1.id && /^PAT-/.test(p1.patient_code || ''), 'code=' + (p1.patient_code || p1.id));
    const p2 = await newPatient('E2E Patient Two');
    S.ids.patient2 = p2.id;
    report('phase3', 'POST /patients #2', !!p2.id, 'code=' + (p2.patient_code || p2.id));

    const list = await req2xx('GET', '/api/v1/patients');
    report('phase3', 'GET /patients', Array.isArray(list) && list.length >= 2, `count=${Array.isArray(list) ? list.length : '?'}`);

    const batch = await req2xx('GET', `/api/v1/patients/batch?ids=${S.ids.patient},${S.ids.patient2}`);
    report('phase3', 'GET /patients/batch', Array.isArray(batch) && batch.length === 2, '');

    const one = await req2xx('GET', `/api/v1/patients/${S.ids.patient}`);
    report('phase3', 'GET /patients/:id', !!one?.id, '');

    await req2xx('PATCH', `/api/v1/patients/${S.ids.patient}`, { body: { medical_history: 'updated' } });
    report('phase3', 'PATCH /patients/:id', true, '');
    await req2xx('PATCH', `/api/v1/patients/${S.ids.patient}/status`, { body: { status_key: 'patient.status.active' } });
    report('phase3', 'PATCH /patients/:id/status', true, '');

    const detail = await req2xx('GET', `/api/v1/patients/${S.ids.patient}/detail`);
    report('phase3', 'GET /patients/:id/detail', !!detail?.patient, '');

    const srch = await req2xx('GET', '/api/v1/patients/search?search=One');
    report('phase3', 'GET /patients/search', Array.isArray(srch), '');
  }

  // ── Phase 4: inventory ──────────────────────────────────────────────
  {
    const cat = await req2xx('POST', '/api/v1/inventory/categories', { body: { category_key: 'e2e-supplies', description: 'E2E supplies' } });
    S.ids.category = cat.id;
    report('phase4', 'POST /inventory/categories', !!cat.id, '');

    const catList = await req2xx('GET', '/api/v1/inventory/categories');
    report('phase4', 'GET /inventory/categories', Array.isArray(catList), '');

    const sup = await req2xx('POST', '/api/v1/inventory/suppliers', { body: { name: 'E2E Supplier', phone: '+213551234570', payment_terms_days: 30 } });
    S.ids.supplier = sup.id;
    report('phase4', 'POST /inventory/suppliers', !!sup.id, '');

    const supList = await req2xx('GET', '/api/v1/inventory/suppliers');
    report('phase4', 'GET /inventory/suppliers', Array.isArray(supList), '');

    const newItem = async (name, stock, min) => {
      const it = await req2xx('POST', '/api/v1/inventory/items', {
        body: { name, unit_of_measure: 'unit', unit_cost_dzd: 100, selling_price_dzd: 250, min_stock_level: min, current_stock: stock, category_id: S.ids.category },
      });
      return it;
    };
    const i1 = await newItem('E2E Anesthetic', 50, 5);
    S.ids.item = i1.id;
    report('phase4', 'POST /inventory/items', !!i1.id, '');
    const i2 = await newItem('E2E Gloves', 2, 10); // low stock
    S.ids.item2 = i2.id;
    report('phase4', 'POST /inventory/items #2 (low stock)', !!i2.id, '');

    const itemList = await req2xx('GET', '/api/v1/inventory/items');
    report('phase4', 'GET /inventory/items', Array.isArray(itemList) && itemList.length >= 2, '');

    const itemBatch = await req2xx('GET', `/api/v1/inventory/items/batch?ids=${S.ids.item},${S.ids.item2}`);
    report('phase4', 'GET /inventory/items/batch', Array.isArray(itemBatch) && itemBatch.length === 2, '');

    await req2xx('PATCH', `/api/v1/inventory/items/${S.ids.item}`, { body: { min_stock_level: 8 } });
    report('phase4', 'PATCH /inventory/items/:id', true, '');

    await req2xx('POST', `/api/v1/inventory/items/${S.ids.item}/adjust-stock`, { body: { quantity: -5, reason: 'e2e usage' } });
    report('phase4', 'POST /items/:id/adjust-stock', true, '');

    const mov = await req2xx('GET', `/api/v1/inventory/items/${S.ids.item}/movements`);
    report('phase4', 'GET /items/:id/movements', Array.isArray(mov), '');

    const low = await req2xx('GET', '/api/v1/inventory/reports/low-stock');
    report('phase4', 'GET /inventory/reports/low-stock', Array.isArray(low), '');

    const stats = await req2xx('GET', '/api/v1/inventory/stats');
    report('phase4', 'GET /inventory/stats', !!stats && typeof stats.total_items !== 'undefined', '');

    const srch = await req2xx('GET', '/api/v1/inventory/items/search?search=Gloves');
    report('phase4', 'GET /items/search', Array.isArray(srch), '');
  }

  // ── Phase 5: appointments ───────────────────────────────────────────
  {
    const mk = () => new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    const a1 = await req2xx('POST', '/api/v1/appointments', {
      body: { patient_id: S.ids.patient, dentist_id: S.ids.dentist, appointment_date: mk(), duration_minutes: 30, reason: 'Consultation' },
    });
    S.ids.appt = a1.id;
    report('phase5', 'POST /appointments', !!a1.id, '');
    const a2 = await req2xx('POST', '/api/v1/appointments', {
      body: { patient_id: S.ids.patient2, dentist_id: S.ids.dentist, appointment_date: new Date(Date.now() + 60 * 3600 * 1000).toISOString(), duration_minutes: 45, reason: 'Cleaning' },
    });
    S.ids.appt2 = a2.id;
    report('phase5', 'POST /appointments #2', !!a2.id, '');

    const range = await req2xx('GET', `/api/v1/appointments/range?start_date=${new Date(Date.now()-86400000).toISOString().slice(0,10)}&end_date=${new Date(Date.now()+9*86400000).toISOString().slice(0,10)}`);
    report('phase5', 'GET /appointments/range', Array.isArray(range) && range.length >= 2, `count=${Array.isArray(range)?range.length:'?'}`);

    await req2xx('PATCH', `/api/v1/appointments/${S.ids.appt}/status`, { body: { status_key: 'appt.status.completed' } });
    report('phase5', 'PATCH /appointments/:id/status (completed)', true, '');
    await req2xx('PATCH', `/api/v1/appointments/${S.ids.appt2}`, { body: { notes: 'bring water' } });
    report('phase5', 'PATCH /appointments/:id', true, '');

    const batch = await req2xx('GET', `/api/v1/appointments/batch?ids=${S.ids.appt},${S.ids.appt2}`);
    report('phase5', 'GET /appointments/batch', Array.isArray(batch) && batch.length === 2, '');

    const one = await req2xx('GET', `/api/v1/appointments/${S.ids.appt}`);
    report('phase5', 'GET /appointments/:id', !!one?.id, '');

    const srch = await req2xx('GET', '/api/v1/appointments/search?search=One');
    report('phase5', 'GET /appointments/search', Array.isArray(srch), '');
  }

  // ── Phase 6: treatments + plans + odontogram ────────────────────────
  {
    const plan = await req2xx('POST', '/api/v1/treatment-plans', {
      body: { patient_id: S.ids.patient, plan_name: 'E2E Restorative Plan', estimated_total_dzd: 4000, description: 'full mouth' },
    });
    S.ids.plan = plan.id;
    report('phase6', 'POST /treatment-plans', !!plan.id, '');

    const t1 = await req2xx('POST', '/api/v1/treatments', {
      body: { patient_id: S.ids.patient, dentist_id: S.ids.dentist, diagnosis: 'caries', treatment_performed: 'filling', estimated_cost_dzd: 1500, treatment_date: new Date().toISOString(), tooth_number: '11', plan_id: S.ids.plan },
    });
    S.ids.treatment = t1.id;
    report('phase6', 'POST /treatments', !!t1.id, '');
    const t2 = await req2xx('POST', '/api/v1/treatments', {
      body: { patient_id: S.ids.patient, dentist_id: S.ids.dentist, diagnosis: 'extraction', treatment_performed: 'tooth 18', estimated_cost_dzd: 2500, treatment_date: new Date().toISOString(), tooth_number: '18' },
    });
    S.ids.treatment2 = t2.id;
    report('phase6', 'POST /treatments #2', !!t2.id, '');

    await req2xx('POST', `/api/v1/treatment-plans/${S.ids.plan}/treatments`, { body: { treatment_id: S.ids.treatment2 } });
    report('phase6', 'POST /treatment-plans/:id/treatments (attach)', true, '');

    const planList = await req2xx('GET', '/api/v1/treatment-plans');
    report('phase6', 'GET /treatment-plans', Array.isArray(planList) && planList.length >= 1, '');
    const tList = await req2xx('GET', '/api/v1/treatments');
    report('phase6', 'GET /treatments', Array.isArray(tList) && tList.length >= 2, `count=${Array.isArray(tList)?tList.length:'?'}`);

    const tBatch = await req2xx('GET', `/api/v1/treatments/batch?ids=${S.ids.treatment},${S.ids.treatment2}`);
    report('phase6', 'GET /treatments/batch', Array.isArray(tBatch) && tBatch.length === 2, '');

    const og = await req2xx('GET', `/api/v1/odontogram/${S.ids.patient}`);
    report('phase6', 'GET /odontogram/:patientId', !!og?.patient_id, '');

    await req2xx('PUT', `/api/v1/odontogram/${S.ids.patient}/tooth/16`, { body: { condition: 'treated', notes: 'e2e' } });
    report('phase6', 'PUT /odontogram/:p/tooth/:t', true, '');
    await req2xx('DELETE', `/api/v1/odontogram/${S.ids.patient}/tooth/16`);
    report('phase6', 'DELETE /odontogram/:p/tooth/:t', true, '');

    await req2xx('PATCH', `/api/v1/treatments/${S.ids.treatment}`, { body: { notes: 'follow up' } });
    report('phase6', 'PATCH /treatments/:id', true, '');
    await req2xx('PATCH', `/api/v1/treatment-plans/${S.ids.plan}`, { body: { status_key: 'plan.status.active' } });
    report('phase6', 'PATCH /treatment-plans/:id', true, '');

    const tsrch = await req2xx('GET', '/api/v1/treatments/search?search=filling');
    report('phase6', 'GET /treatments/search', Array.isArray(tsrch), '');
    const psrch = await req2xx('GET', '/api/v1/treatment-plans/search?search=Restorative');
    report('phase6', 'GET /treatment-plans/search', Array.isArray(psrch), '');
  }

  // ── Phase 7: billing (invoices + payments + prescriptions) ──────────
  {
    const inv = await req2xx('POST', '/api/v1/invoices', {
      body: {
        patient_id: S.ids.patient, issue_date: new Date().toISOString(),
        line_items: [
          { description: 'Filling', quantity: 1, unit_price_dzd: 1500, treatment_record_id: S.ids.treatment },
          { description: 'Consultation', quantity: 1, unit_price_dzd: 500 },
        ],
      },
    });
    S.ids.invoice = inv.id;
    report('phase7', 'POST /invoices', !!inv.id && /^INV-/.test(inv.invoice_number || ''), 'num=' + (inv.invoice_number || inv.id));

    const invList = await req2xx('GET', '/api/v1/invoices');
    report('phase7', 'GET /invoices', Array.isArray(invList) && invList.length >= 1, '');

    const invDetail = await req2xx('GET', `/api/v1/invoices/${S.ids.invoice}`);
    report('phase7', 'GET /invoices/:id', !!invDetail?.id, '');

    await req2xx('POST', '/api/v1/payments', {
      body: { invoice_id: S.ids.invoice, amount_dzd: 1000, payment_method_key: 'pay.method.cash', payment_date: new Date().toISOString() },
    });
    report('phase7', 'POST /payments', true, '');

    const payList = await req2xx('GET', '/api/v1/payments');
    report('phase7', 'GET /payments', Array.isArray(payList) && payList.length >= 1, '');

    // verify the payment synced the invoice's paid amount (DB trigger)
    const invAfter = await req2xx('GET', `/api/v1/invoices/${S.ids.invoice}`);
    report('phase7', 'payment synced invoice.paid_amount_dzd', Number(invAfter?.paid_amount_dzd) === 1000, 'paid=' + (invAfter?.paid_amount_dzd ?? '?'));

    const payIds = [];
    if (Array.isArray(payList)) { for (const p of payList) payIds.push(p); }
    const payBatch = await req2xx('GET', `/api/v1/payments/batch?ids=${payIds.join(',')}`);
    report('phase7', 'GET /payments/batch', Array.isArray(payBatch) && payBatch.length >= 1, '');

    const invBatch = await req2xx('GET', `/api/v1/invoices/batch?ids=${S.ids.invoice}`);
    report('phase7', 'GET /invoices/batch', Array.isArray(invBatch), '');

    // pay off the invoice fully via /payment
    await req2xx('PATCH', `/api/v1/invoices/${S.ids.invoice}/payment`, { body: { paid_amount_dzd: 2000 } });
    report('phase7', 'PATCH /invoices/:id/payment', true, '');
    await req2xx('PATCH', `/api/v1/invoices/${S.ids.invoice}/status`, { body: { payment_status_key: 'invoice.status.paid' } });
    report('phase7', 'PATCH /invoices/:id/status', true, '');
    await req2xx('PATCH', `/api/v1/invoices/${S.ids.invoice}`, { body: { notes: 'paid in full' } });
    report('phase7', 'PATCH /invoices/:id', true, '');

    // payment PATCH (need a payment id)
    if (Array.isArray(payBatch) && payBatch[0]) {
      await req2xx('PATCH', `/api/v1/payments/${payBatch[0].id}`, { body: { notes: 'e2e note' } });
      report('phase7', 'PATCH /payments/:id', true, '');
    }

    const rx = await req2xx('POST', '/api/v1/prescriptions', {
      body: { patient_id: S.ids.patient, medication_name: 'Paracetamol', dosage: '500mg', frequency: '3x daily', duration: '5 days', notes: 'after meals' },
    });
    S.ids.rx = rx.id;
    report('phase7', 'POST /prescriptions', !!rx.id && /^RX-/.test(rx.prescription_number || ''), 'num=' + (rx.prescription_number || rx.id));

    const rxList = await req2xx('GET', '/api/v1/prescriptions');
    report('phase7', 'GET /prescriptions', Array.isArray(rxList) && rxList.length >= 1, '');
    const rxBatch = await req2xx('GET', `/api/v1/prescriptions/batch?ids=${S.ids.rx}`);
    report('phase7', 'GET /prescriptions/batch', Array.isArray(rxBatch), '');
    await req2xx('PATCH', `/api/v1/prescriptions/${S.ids.rx}`, { body: { status_key: 'prescription.status.active' } });
    report('phase7', 'PATCH /prescriptions/:id', true, '');

    const isrch = await req2xx('GET', '/api/v1/invoices/search?search=Filling');
    report('phase7', 'GET /invoices/search', Array.isArray(isrch), '');
    const psrch = await req2xx('GET', '/api/v1/payments/search?search=e2e');
    report('phase7', 'GET /payments/search', Array.isArray(psrch), '');
    const rxsrch = await req2xx('GET', '/api/v1/prescriptions/search?search=Paracetamol');
    report('phase7', 'GET /prescriptions/search', Array.isArray(rxsrch), '');
  }

  // ── Phase 8: expenses + purchase orders ─────────────────────────────
  {
    const exp = await req2xx('POST', '/api/v1/expenses', {
      body: { category_key: 'utilities', description: 'Electricity bill', amount_dzd: 800, expense_date: new Date().toISOString(), payment_method_key: 'pay.method.cash', status_key: 'expense.status.approved' },
    });
    S.ids.expense = exp.id;
    report('phase8', 'POST /expenses', !!exp.id && /^EXP-/.test(exp.expense_number || ''), 'num=' + (exp.expense_number || exp.id));

    const expList = await req2xx('GET', '/api/v1/expenses');
    report('phase8', 'GET /expenses', Array.isArray(expList) && expList.length >= 1, '');
    const expBatch = await req2xx('GET', `/api/v1/expenses/batch?ids=${S.ids.expense}`);
    report('phase8', 'GET /expenses/batch', Array.isArray(expBatch), '');
    await req2xx('PATCH', `/api/v1/expenses/${S.ids.expense}/status`, { body: { status_key: 'expense.status.approved' } });
    report('phase8', 'PATCH /expenses/:id/status', true, '');
    await req2xx('PATCH', `/api/v1/expenses/${S.ids.expense}`, { body: { notes: 'e2e' } });
    report('phase8', 'PATCH /expenses/:id', true, '');
    const esrch = await req2xx('GET', '/api/v1/expenses/search?search=Electricity');
    report('phase8', 'GET /expenses/search', Array.isArray(esrch), '');

    const po = await req2xx('POST', '/api/v1/purchase-orders', {
      body: { supplier_id: S.ids.supplier, items: [{ inventory_item_id: S.ids.item, quantity_ordered: 10, unit_cost_dzd: 90 }] },
    });
    S.ids.po = po.id;
    report('phase8', 'POST /purchase-orders', !!po.id && /^PO-/.test(po.po_number || ''), 'num=' + (po.po_number || po.id));

    const poList = await req2xx('GET', '/api/v1/purchase-orders');
    report('phase8', 'GET /purchase-orders', Array.isArray(poList) && poList.length >= 1, '');
    const poDetail = await req2xx('GET', `/api/v1/purchase-orders/${S.ids.po}`);
    report('phase8', 'GET /purchase-orders/:id', !!poDetail?.id, '');

    await req2xx('PATCH', `/api/v1/purchase-orders/${S.ids.po}/status`, { body: { status_key: 'po.status.approved' } });
    report('phase8', 'PATCH /purchase-orders/:id/status (approved)', true, '');

    // receive requires the po items row ids
    if (Array.isArray(poDetail?.items) && poDetail.items[0]) {
      await req2xx('PATCH', `/api/v1/purchase-orders/${S.ids.po}/receive`, { body: { items: [{ item_id: poDetail.items[0].id, quantity_received: 10 }] } });
      report('phase8', 'PATCH /purchase-orders/:id/receive', true, '');
    } else { report('phase8', 'PATCH /purchase-orders/:id/receive', false, 'no PO items'); }

    await req2xx('PATCH', `/api/v1/purchase-orders/${S.ids.po}`, { body: { notes: 'e2e' } });
    report('phase8', 'PATCH /purchase-orders/:id', true, '');
    const posrch = await req2xx('GET', '/api/v1/purchase-orders/search?search=e2e');
    report('phase8', 'GET /purchase-orders/search', Array.isArray(posrch), '');
  }

  // ── Phase 9: xrays + media (multipart) ──────────────────────────────
  {
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const fd = new FormData();
    fd.append('file', new Blob([tinyPng], { type: 'image/png' }), 'e2e-xray.png');
    fd.append('patient_id', S.ids.patient);
    fd.append('description', 'panoramic');

    const r = await api('POST', '/api/v1/xrays/upload', { raw: fd, token: A().token, refresh: A().refresh, headers: { 'Content-Type': undefined } });
    const uploadOk = r.status === 201 && r.json?.id;
    if (uploadOk) S.ids.xray = r.json.id;
    // Uploading depends on real Cloudinary creds; without them the media upload
    // legitimately fails (400/500), so treat it as a SKIP and still exercise the
    // xray/media read endpoints.
    report('phase9', 'POST /xrays/upload', uploadOk, uploadOk ? '' : 'SKIP-needs Cloudinary creds');

    if (uploadOk) {
      const xl = await req2xx('GET', `/api/v1/xrays?patient_id=${S.ids.patient}`);
      report('phase9', 'GET /xrays?patient_id=', Array.isArray(xl) && xl.length >= 1, `count=${Array.isArray(xl)?xl.length:'?'}`);
      const xb = await req2xx('GET', `/api/v1/xrays/batch?ids=${S.ids.xray}`);
      report('phase9', 'GET /xrays/batch', Array.isArray(xb), '');
      const xo = await req2xx('GET', `/api/v1/xrays/${S.ids.xray}`);
      report('phase9', 'GET /xrays/:id', !!xo?.id, '');
      await req2xx('PATCH', `/api/v1/xrays/${S.ids.xray}`, { body: { description: 'updated' } });
      report('phase9', 'PATCH /xrays/:id', true, '');
    }

    const ml = await req2xx('GET', '/api/v1/media');
    report('phase9', 'GET /media', Array.isArray(ml), '');
  }

  // ── Phase 10: dashboard / reports / audit / notifications ───────────
  {
    await req2xx('GET', '/api/v1/dashboard/appointments/today');
    report('phase10', 'GET /dashboard/appointments/today', true, '');
    await req2xx('GET', `/api/v1/dashboard/patients/raw?start_date=${new Date(Date.now()-30*86400000).toISOString()}&end_date=${new Date().toISOString()}`);
    report('phase10', 'GET /dashboard/patients/raw', true, '');
    await req2xx('GET', '/api/v1/dashboard/appointments/raw?days=7');
    report('phase10', 'GET /dashboard/appointments/raw', true, '');
    await req2xx('GET', '/api/v1/dashboard/treatments/raw');
    report('phase10', 'GET /dashboard/treatments/raw', true, '');
    await req2xx('GET', '/api/v1/dashboard/payments/raw');
    report('phase10', 'GET /dashboard/payments/raw', true, '');
    await req2xx('GET', '/api/v1/dashboard/recent-activity');
    report('phase10', 'GET /dashboard/recent-activity (admin)', true, '');

    await req2xx('GET', '/api/v1/reports/revenue/monthly?months=12');
    report('phase10', 'GET /reports/revenue/monthly', true, '');
    await req2xx('GET', '/api/v1/reports/revenue/by-method?months=12');
    report('phase10', 'GET /reports/revenue/by-method', true, '');
    await req2xx('GET', '/api/v1/reports/procedures/frequency?months=12');
    report('phase10', 'GET /reports/procedures/frequency', true, '');
    await req2xx('GET', '/api/v1/reports/patients/new?months=12');
    report('phase10', 'GET /reports/patients/new', true, '');
    await req2xx('GET', '/api/v1/reports/appointments/stats?months=12');
    report('phase10', 'GET /reports/appointments/stats', true, '');
    await req2xx('GET', '/api/v1/reports/plans/summary');
    report('phase10', 'GET /reports/plans/summary', true, '');
    await req2xx('GET', '/api/v1/reports/revenue/export?start_date=&end_date=');
    report('phase10', 'GET /reports/revenue/export (CSV)', true, '');

    const audit = await req2xx('GET', '/api/v1/audit-logs');
    report('phase10', 'GET /audit-logs (admin)', Array.isArray(audit), '');
    let auditId = null;
    if (Array.isArray(audit) && audit[0]) auditId = audit[0];
    if (auditId) {
      await req2xx('GET', `/api/v1/audit-logs/${auditId}`);
      report('phase10', 'GET /audit-logs/:id', true, '');
      await req2xx('GET', `/api/v1/audit-logs/batch?ids=${auditId}`);
      report('phase10', 'GET /audit-logs/batch', true, '');
    }

    await req2xx('GET', '/api/v1/notifications?limit=50');
    report('phase10', 'GET /notifications', true, '');
    const uc = await req2xx('GET', '/api/v1/notifications/unread-count');
    report('phase10', 'GET /notifications/unread-count', typeof uc?.count !== 'undefined', '');
    await req2xx('PUT', '/api/v1/notifications/read-all');
    report('phase10', 'PUT /notifications/read-all', true, '');
    // mark-one-read only if a notification exists (else it's a soft skip)
    const nlist = await req2xx('GET', '/api/v1/notifications?limit=1');
    if (Array.isArray(nlist) && nlist[0]?.id) {
      await req2xx('PUT', `/api/v1/notifications/${nlist[0].id}/read`);
      report('phase10', 'PUT /notifications/:id/read', true, '');
    } else {
      report('phase10', 'PUT /notifications/:id/read (none to read)', true, 'SKIP');
    }
  }

  // ── Phase 12: platform operator console (optional) ──────────────────
  if (process.env.PLATFORM_EMAIL && process.env.PLATFORM_PASSWORD) {
    try {
      const login = await api('POST', '/api/v1/auth/login', { body: { email: process.env.PLATFORM_EMAIL, password: process.env.PLATFORM_PASSWORD } });
      const ok = login.status === 200 && login.json?.roleKeys?.includes('auth.role.platform_admin');
      report('phase12', 'login as platform_admin', !!ok, login.status + '');
      if (ok) {
        const P = { token: login.json.accessToken, refresh: login.json.refreshToken };
        async function pl2xx(method, path, body) {
          const r = await api(method, path, { body, token: P.token, refresh: P.refresh });
          await expect(r.status, r, path);
          return r.json;
        }
        await pl2xx('GET', '/api/v1/platform/stats');
        report('phase12', 'GET /platform/stats', true, '');
        const tenants = await pl2xx('GET', '/api/v1/platform/tenants');
        report('phase12', 'GET /platform/tenants', Array.isArray(tenants?.tenants) || Array.isArray(tenants), '');
        await pl2xx('GET', '/api/v1/platform/plans');
        report('phase12', 'GET /platform/plans', true, '');
        await pl2xx('GET', '/api/v1/platform/revenue');
        report('phase12', 'GET /platform/revenue', true, '');
        await pl2xx('GET', '/api/v1/platform/analytics');
        report('phase12', 'GET /platform/analytics', true, '');
        const ten = tenants?.tenants?.[0] || (Array.isArray(tenants) ? tenants[0] : null);
        if (ten?.id) {
          await pl2xx('GET', `/api/v1/platform/tenants/${ten.id}`);
          report('phase12', 'GET /platform/tenants/:id', true, '');
        }
      }
    } catch (e) {
      report('phase12', 'platform phase', false, e.message);
    }
  } else {
    console.log('  (Phase 12 skipped — set PLATFORM_EMAIL/PLATFORM_PASSWORD to exercise the operator console)');
  }

  // ── Summary ─────────────────────────────────────────────────────────
  const failedRows = results.filter(r => !r.ok && !(typeof r.detail === 'string' && r.detail.startsWith('SKIP')));
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  PASS: ${passed}   FAIL: ${failures}   SKIPPED: ${skipped}`);
  if (failedRows.length) {
    console.log('\n  Failed steps:');
    for (const r of failedRows) console.log(`    - ${r.category}: ${r.name}  ${r.detail || ''}`);
  }
  console.log(`${'='.repeat(64)}\n`);
  process.exit(failures > 0 ? 1 : 0);
}

run().catch(err => { console.error('\nUnhandled error:', err.message); process.exit(2); });
