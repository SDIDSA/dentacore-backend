/* Sera operator console — served same-origin; CSP script-src 'self' friendly.
   Lang/theme pre-paint + header switchers come from site.js (same dc-lang /
   dc-theme persistence as the rest of the site). Auth token lives in
   sessionStorage; every API call carries it as a bearer token and the backend
   rejects anything that is not auth.role.platform_admin. */
(function () {
  'use strict';

  var de = document.documentElement;

  var TOKEN_KEY = 'platform-token';
  var STATUSES = ['active', 'trial', 'suspended', 'cancelled', 'expired'];
  var API = '/api/v1/platform';

  var T = {
    en: {
      doc_title: 'Sera Platform', kicker: 'Platform', title: 'Sera Operator Console',
      login_lede: 'Operator access only.', email: 'Email', password: 'Password', signin: 'Sign in',
      logout: 'Log out', tab_overview: 'Overview', tab_clinics: 'Clinics',
      stat_clinics: 'Clinics', stat_active: 'Active', stat_trial: 'Trial', stat_suspended: 'Suspended',
      stat_signups: 'Signups · 30d', stat_users: 'Users', stat_patients: 'Patients', stat_appts: 'Appointments',
      recent_signups: 'Recent signups', th_clinic: 'Clinic', th_address: 'Address', th_status: 'Status',
      th_plan: 'Plan', th_users: 'Users', th_patients: 'Patients', th_appts: 'Appts', th_created: 'Created',
      th_role: 'Role', th_lastlogin: 'Last login', search_ph: 'Search name or address…',
      prev: '‹ Prev', next: 'Next ›', back: 'Back to clinics', subscription: 'Subscription',
      trial_ends: 'Trial / subscription ends', save: 'Save', saved: 'Saved ✓', clinic_info: 'Clinic',
      team: 'Team', name: 'Name', footer: 'operator console · internal use',
      never: 'never', no_results: 'No clinics match.', loading: 'Loading…',
      err_generic: 'Something went wrong — please try again.',
      err_credentials: 'Invalid email or password.', err_forbidden: 'This account is not a platform operator.',
      err_session: 'Session expired — sign in again.', confirm: 'Confirm', aria_theme: 'Switch color theme'
    },
    fr: {
      doc_title: 'Sera Plateforme', kicker: 'Plateforme', title: 'Console opérateur Sera',
      login_lede: 'Accès opérateur uniquement.', email: 'E-mail', password: 'Mot de passe', signin: 'Se connecter',
      logout: 'Déconnexion', tab_overview: 'Vue d’ensemble', tab_clinics: 'Cabinets',
      stat_clinics: 'Cabinets', stat_active: 'Actifs', stat_trial: 'Essai', stat_suspended: 'Suspendus',
      stat_signups: 'Inscriptions · 30j', stat_users: 'Utilisateurs', stat_patients: 'Patients', stat_appts: 'Rendez-vous',
      recent_signups: 'Inscriptions récentes', th_clinic: 'Cabinet', th_address: 'Adresse', th_status: 'Statut',
      th_plan: 'Formule', th_users: 'Utilisateurs', th_patients: 'Patients', th_appts: 'Rendez-vous', th_created: 'Créé le',
      th_role: 'Rôle', th_lastlogin: 'Dernière connexion', search_ph: 'Rechercher nom ou adresse…',
      prev: '‹ Préc.', next: 'Suiv. ›', back: 'Retour aux cabinets', subscription: 'Abonnement',
      trial_ends: 'Fin d’essai / d’abonnement', save: 'Enregistrer', saved: 'Enregistré ✓', clinic_info: 'Cabinet',
      team: 'Équipe', name: 'Nom', footer: 'console opérateur · usage interne',
      never: 'jamais', no_results: 'Aucun cabinet trouvé.', loading: 'Chargement…',
      err_generic: 'Une erreur est survenue — réessayez.',
      err_credentials: 'E-mail ou mot de passe invalide.', err_forbidden: 'Ce compte n’est pas un opérateur plateforme.',
      err_session: 'Session expirée — reconnectez-vous.', confirm: 'Confirmer', aria_theme: 'Changer de thème'
    },
    ar: {
      doc_title: 'منصة Sera', kicker: 'المنصة', title: 'لوحة تحكم مشغل Sera',
      login_lede: 'للمشغلين فقط.', email: 'البريد الإلكتروني', password: 'كلمة المرور', signin: 'تسجيل الدخول',
      logout: 'تسجيل الخروج', tab_overview: 'نظرة عامة', tab_clinics: 'العيادات',
      stat_clinics: 'العيادات', stat_active: 'نشطة', stat_trial: 'تجريبية', stat_suspended: 'موقوفة',
      stat_signups: 'تسجيلات · 30ي', stat_users: 'المستخدمون', stat_patients: 'المرضى', stat_appts: 'المواعيد',
      recent_signups: 'تسجيلات حديثة', th_clinic: 'العيادة', th_address: 'العنوان', th_status: 'الحالة',
      th_plan: 'الخطة', th_users: 'المستخدمون', th_patients: 'المرضى', th_appts: 'المواعيد', th_created: 'أُنشئت',
      th_role: 'الدور', th_lastlogin: 'آخر دخول', search_ph: 'ابحث بالاسم أو العنوان…',
      prev: '‹ السابق', next: 'التالي ›', back: 'عودة إلى العيادات', subscription: 'الاشتراك',
      trial_ends: 'نهاية التجربة / الاشتراك', save: 'حفظ', saved: 'تم الحفظ ✓', clinic_info: 'العيادة',
      team: 'الفريق', name: 'الاسم', footer: 'لوحة المشغل · استخدام داخلي',
      never: 'أبداً', no_results: 'لا توجد عيادات مطابقة.', loading: 'جارٍ التحميل…',
      err_generic: 'حدث خطأ ما — حاول مجدداً.',
      err_credentials: 'بريد إلكتروني أو كلمة مرور غير صحيحة.', err_forbidden: 'هذا الحساب ليس مشغّل منصة.',
      err_session: 'انتهت الجلسة — سجّل الدخول مجدداً.', confirm: 'تأكيد', aria_theme: 'تبديل المظهر'
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  function t(k) { var l = SITE.lang; return (T[l] && T[l][k]) || T.en[k] || k; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function locale() { return SITE.lang === 'ar' ? 'ar-DZ' : (SITE.lang === 'fr' ? 'fr-FR' : 'en-GB'); }
  function fmtDate(v) {
    if (!v) return t('never');
    return new Date(v).toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function statusKey(full) { return full ? full.replace('tenant.status.', '') : ''; }
  function statusLabel(full) {
    var s = statusKey(full);
    return { active: t('stat_active'), trial: t('stat_trial'), suspended: t('stat_suspended'),
             cancelled: s, expired: s }[s] || s;
  }

  var state = { view: 'overview', page: 1, limit: 20, total: 0, search: '', status: '', detailId: null };

  // ---- api helper ----------------------------------------------------------
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    var token = sessionStorage.getItem(TOKEN_KEY);
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (r.status === 401 && token) { signOut(); throw { code: 'session' }; }
        return { ok: r.ok, status: r.status, body: body };
      });
    });
  }

  // ---- auth ----------------------------------------------------------------
  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    $('app').classList.add('hidden');
    $('login').classList.remove('hidden');
    $('logoutBtn').style.visibility = 'hidden';
  }

  function signIn() {
    var email = $('email').value.trim();
    var password = $('password').value;
    var err = $('loginErr');
    err.classList.add('hidden');
    if (!email || !password) return;

    fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); })
      .then(function (res) {
        if (!res.ok) {
          err.textContent = t(res.status === 401 ? 'err_credentials' : 'err_generic');
          err.classList.remove('hidden');
          return;
        }
        if (res.body.roleKey !== 'auth.role.platform_admin') {
          err.textContent = t('err_forbidden');
          err.classList.remove('hidden');
          return;
        }
        sessionStorage.setItem(TOKEN_KEY, res.body.accessToken);
        enterApp();
      })
      .catch(function () {
        err.textContent = t('err_generic');
        err.classList.remove('hidden');
      });
  }

  function enterApp() {
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('logoutBtn').style.visibility = 'visible';
    switchView('overview');
  }

  // ---- rendering -----------------------------------------------------------
  function statCard(label, value) {
    return '<div class="stat"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div></div>';
  }

  function renderStats() {
    var grid = $('statGrid');
    grid.innerHTML = '<div class="stat"><div class="k">' + esc(t('loading')) + '</div></div>';
    api('/stats').then(function (res) {
      if (!res.ok) return;
      var s = res.body;
      grid.innerHTML =
        statCard(t('stat_clinics'), s.tenants.total) +
        statCard(t('stat_active'), s.tenants.active) +
        statCard(t('stat_trial'), s.tenants.trial) +
        statCard(t('stat_suspended'), s.tenants.suspended) +
        statCard(t('stat_signups'), s.tenants.signups_30d) +
        statCard(t('stat_users'), s.users) +
        statCard(t('stat_patients'), s.patients) +
        statCard(t('stat_appts'), s.appointments);
      renderRecent();
    }).catch(function () {});
  }

  function renderRecent() {
    var body = $('recentBody');
    api('/tenants?limit=5&page=1').then(function (res) {
      if (!res.ok) return;
      if (!res.body.tenants.length) {
        body.innerHTML = '<tr><td colspan="4" class="note">' + esc(t('no_results')) + '</td></tr>';
        return;
      }
      body.innerHTML = res.body.tenants.map(function (tn) {
        return '<tr data-id="' + esc(tn.id) + '">' +
          '<td><b>' + esc(tn.name) + '</b></td>' +
          '<td class="num">' + esc(tn.subdomain) + '</td>' +
          '<td><span class="pill ' + esc(statusKey(tn.subscription_status)) + '">' + esc(statusLabel(tn.subscription_status)) + '</span></td>' +
          '<td class="num">' + esc(fmtDate(tn.created_at)) + '</td></tr>';
      }).join('');
      wireRows(body);
    }).catch(function () {});
  }

  function renderTenants() {
    var body = $('tenantsBody');
    body.innerHTML = '<tr><td colspan="8" class="note">' + esc(t('loading')) + '</td></tr>';
    var qs = '?page=' + state.page + '&limit=' + state.limit;
    if (state.search) qs += '&search=' + encodeURIComponent(state.search);
    if (state.status) qs += '&status=' + encodeURIComponent(state.status);
    api('/tenants' + qs).then(function (res) {
      if (!res.ok) return;
      state.total = res.body.total;
      if (!res.body.tenants.length) {
        body.innerHTML = '<tr><td colspan="8" class="note">' + esc(t('no_results')) + '</td></tr>';
      } else {
        body.innerHTML = res.body.tenants.map(function (tn) {
          return '<tr data-id="' + esc(tn.id) + '">' +
            '<td><b>' + esc(tn.name) + '</b></td>' +
            '<td class="num">' + esc(tn.subdomain) + '</td>' +
            '<td><span class="pill ' + esc(statusKey(tn.subscription_status)) + '">' + esc(statusLabel(tn.subscription_status)) + '</span></td>' +
            '<td class="num">' + esc(tn.subscription_plan || '—') + '</td>' +
            '<td class="num">' + esc(tn.user_count) + '</td>' +
            '<td class="num">' + esc(tn.patient_count) + '</td>' +
            '<td class="num">' + esc(tn.appointment_count) + '</td>' +
            '<td class="num">' + esc(fmtDate(tn.created_at)) + '</td></tr>';
        }).join('');
      }
      var from = state.total === 0 ? 0 : (state.page - 1) * res.body.limit + 1;
      var to = Math.min(state.page * res.body.limit, state.total);
      $('pagerInfo').textContent = from + '–' + to + ' / ' + state.total;
      $('prevBtn').disabled = state.page <= 1;
      $('nextBtn').disabled = to >= state.total;
    }).catch(function () {});
  }

  function renderDetail() {
    var err = $('detailErr');
    err.classList.add('hidden');
    api('/tenants/' + state.detailId).then(function (res) {
      if (!res.ok) return;
      var tn = res.body.tenant;
      $('detailPill').textContent = statusLabel(tn.subscription_status);
      $('detailPill').className = 'pill ' + statusKey(tn.subscription_status);
      $('editStatus').value = tn.subscription_status;
      $('editPlan').value = tn.subscription_plan || '';
      $('editEnds').value = tn.subscription_ends_at ? tn.subscription_ends_at.slice(0, 10) : '';
      $('detailInfo').innerHTML =
        '<dt>' + esc(t('th_clinic')) + '</dt><dd>' + esc(tn.name) + '</dd>' +
        '<dt>' + esc(t('th_address')) + '</dt><dd>sera.dz/book/' + esc(tn.subdomain) + '</dd>' +
        '<dt>' + esc(t('stat_users')) + '</dt><dd>' + esc(tn.user_count) + '</dd>' +
        '<dt>' + esc(t('stat_patients')) + '</dt><dd>' + esc(tn.patient_count) + '</dd>' +
        '<dt>' + esc(t('stat_appts')) + '</dt><dd>' + esc(tn.appointment_count) + '</dd>' +
        '<dt>' + esc(t('th_created')) + '</dt><dd>' + esc(fmtDate(tn.created_at)) + '</dd>';
      $('usersBody').innerHTML = res.body.users.map(function (u) {
        return '<tr style="cursor:default">' +
          '<td>' + esc(u.full_name) + '</td>' +
          '<td class="num">' + esc(u.email) + '</td>' +
          '<td class="num">' + esc(u.role_key.replace('auth.role.', '')) + '</td>' +
          '<td class="num">' + esc(u.status_key.replace('user.status.', '')) + '</td>' +
          '<td class="num">' + esc(fmtDate(u.last_login_at)) + '</td></tr>';
      }).join('');
    }).catch(function () {});
  }

  function saveDetail() {
    var err = $('detailErr');
    var ok = $('saveOk');
    err.classList.add('hidden');
    ok.classList.add('hidden');
    var body = {
      subscription_status: $('editStatus').value,
      subscription_plan: $('editPlan').value.trim() || null,
      subscription_ends_at: $('editEnds').value ? new Date($('editEnds').value + 'T12:00:00Z').toISOString() : null,
    };
    api('/tenants/' + state.detailId, { method: 'PATCH', body: JSON.stringify(body) }).then(function (res) {
      if (!res.ok) {
        err.textContent = t('err_generic');
        err.classList.remove('hidden');
        return;
      }
      ok.classList.remove('hidden');
      $('detailPill').textContent = statusLabel(res.body.tenant.subscription_status);
      $('detailPill').className = 'pill ' + statusKey(res.body.tenant.subscription_status);
      setTimeout(function () { ok.classList.add('hidden'); }, 2500);
    }).catch(function () {
      err.textContent = t('err_generic');
      err.classList.remove('hidden');
    });
  }

  // ---- navigation ----------------------------------------------------------
  function switchView(view, detailId) {
    state.view = view;
    state.detailId = detailId || null;
    $('viewOverview').classList.toggle('hidden', view !== 'overview');
    $('viewClinics').classList.toggle('hidden', view !== 'clinics');
    $('viewDetail').classList.toggle('hidden', view !== 'detail');
    $('tabOverview').classList.toggle('on', view === 'overview');
    $('tabClinics').classList.toggle('on', view !== 'overview');
    if (view === 'overview') renderStats();
    if (view === 'clinics') renderTenants();
    if (view === 'detail') renderDetail();
  }

  function wireRows(container) {
    Array.prototype.forEach.call(container.querySelectorAll('tr[data-id]'), function (row) {
      row.addEventListener('click', function () { switchView('detail', row.getAttribute('data-id')); });
    });
  }

  function applyLang() {
    document.title = t('doc_title');
    document.querySelectorAll('[data-i]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i'));
    });
    document.querySelectorAll('[data-i-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i-ph'));
    });
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-l') === SITE.lang);
    });
    $('themeBtn').setAttribute('aria-label', t('aria_theme'));
    if (state.view === 'overview' && !$('app').classList.contains('hidden')) renderStats();
    if (state.view === 'clinics' && !$('app').classList.contains('hidden')) renderTenants();
  }

  // ---- boot ----------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    applyLang();
    SITE.wireControls(applyLang);

    // status filter chips
    var chips = $('statusChips');
    [''].concat(STATUSES).forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (s === '' ? ' on' : '');
      b.setAttribute('data-s', s);
      b.textContent = s === '' ? 'All' : statusLabel('tenant.status.' + s);
      b.addEventListener('click', function () {
        state.status = s;
        state.page = 1;
        chips.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', c === b); });
        renderTenants();
      });
      chips.appendChild(b);
    });

    // subscription status select
    var sel = $('editStatus');
    STATUSES.forEach(function (s) {
      var o = document.createElement('option');
      o.value = 'tenant.status.' + s;
      o.textContent = statusLabel('tenant.status.' + s);
      sel.appendChild(o);
    });

    $('loginBtn').addEventListener('click', signIn);
    $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
    $('email').addEventListener('keydown', function (e) { if (e.key === 'Enter') signIn(); });
    $('logoutBtn').addEventListener('click', signOut);

    $('tabOverview').addEventListener('click', function () { switchView('overview'); });
    $('tabClinics').addEventListener('click', function () { switchView('clinics'); });
    $('backBtn').addEventListener('click', function () { switchView('clinics'); });
    $('saveBtn').addEventListener('click', saveDetail);

    $('prevBtn').addEventListener('click', function () { state.page--; renderTenants(); });
    $('nextBtn').addEventListener('click', function () { state.page++; renderTenants(); });

    var searchTimer = null;
    $('search').addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.search = $('search').value.trim();
        state.page = 1;
        renderTenants();
      }, 250);
    });

    // restore session
    if (sessionStorage.getItem(TOKEN_KEY)) {
      api('/stats').then(function (res) {
        if (res.status === 403) { signOut(); return; }
        enterApp();
      }).catch(function () {});
    }
  });
})();
