/* Booking portal client — served same-origin; CSP script-src 'self' friendly.
   Pre-paint section resolves lang + theme synchronously; main logic waits for
   DOMContentLoaded. Switchers persist to dc-lang / dc-theme — the SAME keys
   the marketing site uses, so preferences carry across both. */
(function () {
  'use strict';

  // ---- pre-paint: resolve language and theme before first paint ------------
  var de = document.documentElement;
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  var qs0 = new URLSearchParams(location.search);
  var ql = qs0.get('lang');
  var lang = ['en', 'fr', 'ar'].indexOf(ql || '') >= 0 ? ql
    : ['en', 'fr', 'ar'].indexOf(stored('dc-lang') || '') >= 0 ? stored('dc-lang')
    : (function () {
        var nav = (navigator.language || 'en').toLowerCase();
        return nav.indexOf('fr') === 0 ? 'fr' : (nav.indexOf('ar') === 0 ? 'ar' : 'en');
      })();

  var th = stored('dc-theme');
  if (th !== 'dark' && th !== 'light') {
    th = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  var qt = qs0.get('theme');            // one-shot override (?theme=dark|light), not persisted
  if (qt === 'dark' || qt === 'light') th = qt;
  de.setAttribute('lang', lang);
  de.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  de.setAttribute('data-theme', th);

  document.addEventListener('DOMContentLoaded', function () {
    var qs = new URLSearchParams(location.search);
    var clinic = (qs.get('clinic') || '').toLowerCase();

    var T = {
      en: { doc_title: 'Book an appointment', kicker:'Book online', loading:'loading clinic…',
        notfound:'This booking link is not valid. Please check the address or contact the clinic directly.',
        step_dentist:'Choose your practitioner', step_service:'Service (optional)', step_date:'Pick a day',
        step_time:'Pick a time', step_you:'Your details', name:'Full name', phone:'Phone (Algerian mobile)',
        notes:'Reason / notes (optional)', confirm:'Confirm appointment', noslots:'No free times on this day.',
        footer:'online booking · no account needed', done_kicker:'Confirmed', done_code:'Your patient number',
        when:'When', dentist:'Practitioner', duration:'Duration',
        done_note:'Arrive 5 minutes early. To reschedule, call the clinic and give this patient number.',
        err_generic:'Something went wrong — please try again.', err_slot:'That time was just taken. Pick another.',
        err_limit:'You already have an upcoming booking with this phone number.',
        err_phone:'Please enter your phone as +213XXXXXXXXX.', err_name:'Please enter your full name.',
        sending:'Sending…', min:'min', aria_theme:'Switch color theme', aria_lang:'Language' },
      fr: { doc_title:'Prendre rendez-vous', kicker:'Rendez-vous en ligne', loading:'chargement du cabinet…',
        notfound:'Ce lien de réservation n\u2019est pas valide. Vérifiez l\u2019adresse ou contactez directement le cabinet.',
        step_dentist:'Choisissez votre praticien', step_service:'Acte (facultatif)', step_date:'Choisissez le jour',
        step_time:'Choisissez l\u2019heure', step_you:'Vos coordonnées', name:'Nom complet',
        phone:'Téléphone (mobile algérien)', notes:'Motif / remarques (facultatif)', confirm:'Confirmer le rendez-vous',
        noslots:'Aucun créneau libre ce jour.', footer:'réservation en ligne · sans compte',
        done_kicker:'Confirmé', done_code:'Votre numéro de patient', when:'Quand', dentist:'Praticien', duration:'Durée',
        done_note:'Arrivez 5 minutes en avance. Pour modifier, appelez le cabinet et donnez ce numéro de patient.',
        err_generic:'Une erreur est survenue — réessayez.', err_slot:'Ce créneau vient d\u2019être pris. Choisissez-en un autre.',
        err_limit:'Vous avez déjà un rendez-vous à venir avec ce numéro.',
        err_phone:'Saisissez votre téléphone au format +213XXXXXXXXX.', err_name:'Saisissez votre nom complet.',
        sending:'Envoi…', min:'min', aria_theme:'Changer de thème', aria_lang:'Langue' },
      ar: { doc_title:'حجز موعد', kicker:'الحجز عبر الإنترنت', loading:'جارٍ تحميل العيادة…',
        notfound:'رابط الحجز غير صالح. تحقق من العنوان أو اتصل بالعيادة مباشرة.',
        step_dentist:'اختر طبيبك', step_service:'نوع الخدمة (اختياري)', step_date:'اختر اليوم',
        step_time:'اختر الوقت', step_you:'معلوماتك', name:'الاسم الكامل', phone:'الهاتف المحمول',
        notes:'سبب الزيارة (اختياري)', confirm:'تأكيد الموعد', noslots:'لا توجد أوقات متاحة في هذا اليوم.',
        footer:'حجز إلكتروني · بدون حساب', done_kicker:'تم التأكيد', done_code:'رقم المريض الخاص بك',
        when:'الموعد', dentist:'الطبيب', duration:'المدة',
        done_note:'يرجى الحضور قبل ٥ دقائق. لتغيير الموعد، اتصل بالعيادة وأعطِ رقم المريض.',
        err_generic:'حدث خطأ — حاول مجدداً.', err_slot:'تم حجز هذا الوقت للتو. اختر وقتاً آخر.',
        err_limit:'لديك موعد قادم بهذا الرقم بالفعل.', err_phone:'أدخل هاتفك بالصيغة +213XXXXXXXXX.',
        err_name:'أدخل اسمك الكامل.', sending:'جارٍ الإرسال…', min:'د', aria_theme:'تغيير المظهر', aria_lang:'اللغة' }
    };

    var $ = function (id) { return document.getElementById(id); };
    var qsa = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };
    var LANG = de.getAttribute('lang');

    function t(k) { return (T[LANG] && T[LANG][k]) || T.en[k] || k; }
    function locale() { return LANG === 'ar' ? 'ar-DZ' : (LANG === 'fr' ? 'fr-FR' : 'en-GB'); }
    function fmtDate(iso) {
      return new Date(iso + 'T00:00:00Z').toLocaleDateString(locale(),
        { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function applyLang() {
      LANG = de.getAttribute('lang');
      document.title = t('doc_title');
      qsa('[data-i]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i')); });
      qsa('.lang-btn').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-l') === LANG); });
      $('themeBtn').setAttribute('aria-label', t('aria_theme'));
      renderDates();          // localized day labels; preserves selection
      syncSummary();
    }

    function setLang(l) {
      if (['en', 'fr', 'ar'].indexOf(l) < 0 || l === LANG) return;
      try { localStorage.setItem('dc-lang', l); } catch (e) {}
      de.setAttribute('lang', l);
      de.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
      applyLang();
    }

    qsa('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(this.getAttribute('data-l')); });
    });

    $('themeBtn').addEventListener('click', function () {
      var next = de.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      de.setAttribute('data-theme', next);
      try { localStorage.setItem('dc-theme', next); } catch (e) {}
    });

    // ---- state ----
    var state = { dentists: [], dentistId: null, serviceId: null, date: null,
                  slot: null, dates: [], slotMinutes: 30 };

    function show(id) { $(id).classList.remove('hidden'); }
    function hide(id) { $(id).classList.add('hidden'); }
    function api(path, opts) {
      return fetch('/api/v1/public/' + encodeURIComponent(clinic) + path, opts)
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); });
    }

    function mark(container, el) {
      Array.prototype.forEach.call(container.children, function (c) { c.classList.remove('on'); });
      if (el) el.classList.add('on');
    }

    function renderDates() {
      var box = $('dates'); box.innerHTML = '';
      state.dates = [];
      for (var i = 1; i <= 14; i++) {
        var d = new Date(Date.now() + i * 86400000 + 3600000); // +1d in Algiers wall clock
        var iso = d.toISOString().slice(0, 10);
        state.dates.push(iso);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = fmtDate(iso); b.dataset.date = iso;
        if (iso === state.date) b.classList.add('on');
        b.addEventListener('click', function () { pickDate(this.dataset.date); });
        box.appendChild(b);
      }
    }

    function pickDate(iso) {
      state.date = iso; state.slot = null;
      mark($('dates'), [].filter.call($('dates').children, function (c) { return c.dataset.date === iso; })[0]);
      loadSlots();
    }

    function loadSlots() {
      var box = $('slots'); box.innerHTML = '';
      hide('noSlots'); $('pickedSummary').textContent = '';
      api('/slots?date=' + state.date + (state.dentistId ? '&dentist_id=' + state.dentistId : ''))
        .then(function (r) {
          if (!r.ok) return;
          var groups = r.body.availability || [];
          var flat = [];
          groups.forEach(function (g) {
            g.slots.forEach(function (s) { flat.push({ t: s, dentist: g.dentist_id, dur: g.slot_minutes }); });
          });
          flat.sort(function (a, b2) { return a.t.localeCompare(b2.t); });
          if (!flat.length) { show('noSlots'); return; }
          flat.forEach(function (f) {
            var b = document.createElement('button');
            b.type = 'button'; b.className = 'slot'; b.textContent = f.t;
            b.addEventListener('click', function () {
              state.slot = f.t; state.slotMinutes = f.dur;
              state.dentistId = state.dentistId || f.dentist;
              mark($('slots'), b); syncSummary();
            });
            box.appendChild(b);
          });
        });
    }

    function syncSummary() {
      if (!state.date || !state.slot) return;
      $('pickedSummary').textContent = fmtDate(state.date) + ' · ' + state.slot;
    }

    function formError(key) {
      var el = $('formErr'); el.textContent = t(key); show('formErr');
    }

    applyLang();

    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(clinic)) {
      show('state-notfound'); hide('state-loading'); return;
    }

    Promise.all([api('/dentists'), api('/services')]).then(function (rs) {
      hide('state-loading');
      if (!rs[0].ok || !rs[1].ok) { show('state-notfound'); return; }
      state.dentists = rs[0].body;

      $('clinicName').textContent = clinic.replace(/-/g, ' ');

      var dbx = $('dentists');
      state.dentists.forEach(function (d) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = d.full_name;
        b.addEventListener('click', function () {
          state.dentistId = d.id;
          mark(dbx, b);
          if (state.date) loadSlots();
        });
        dbx.appendChild(b);
      });

      var sb = $('services');
      (rs[1].body || []).forEach(function (s) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip';
        b.textContent = s.category_key.replace(/^[^.]*\./, '').replace(/_/g, ' ');
        b.addEventListener('click', function () {
          state.serviceId = (state.serviceId === s.id) ? null : s.id;
          mark(sb, state.serviceId ? b : null);
        });
        sb.appendChild(b);
      });

      renderDates();
      show('flow');

      $('submitBtn').addEventListener('click', function () {
        hide('formErr');
        var name = $('fullName').value.trim();
        var phone = $('phone').value.replace(/[\s.-]/g, '');
        if (name.length < 2) return formError('err_name');
        if (!/^\+213[0-9]{9}$/.test(phone)) return formError('err_phone');
        if (!state.dentistId || !state.date || !state.slot) return formError('err_generic');

        var when = state.date + 'T' +
          String(Number(state.slot.slice(0, 2)) - 1).padStart(2, '0') + ':' +
          state.slot.slice(3) + ':00.000Z';

        var btn = $('submitBtn'), old = btn.textContent;
        btn.disabled = true; btn.textContent = t('sending');
        api('/bookings', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: name, phone: phone, dentist_id: state.dentistId,
            appointment_date: when, category_id: state.serviceId || undefined,
            notes: $('notes').value.trim() || undefined
          })
        }).then(function (r) {
          btn.disabled = false; btn.textContent = old;
          if (r.status === 201) {
            hide('flow');
            $('donePatientCode').textContent = r.body.patient_code;
            $('doneWhen').textContent = fmtDate(state.date) + ' · ' + state.slot;
            var dn = state.dentists.find(function (d) { return d.id === state.dentistId; });
            $('doneDentist').textContent = dn ? dn.full_name : '—';
            $('doneDuration').textContent = state.slotMinutes + ' ' + t('min');
            show('done');
            window.scrollTo(0, 0);
          } else if (r.body && r.body.error === 'public.booking.slot_taken') { formError('err_slot'); loadSlots(); }
          else if (r.body && r.body.error === 'public.booking.limit_reached') { formError('err_limit'); }
          else if (r.body && r.body.error === 'public.booking.slot_unavailable') { formError('err_slot'); loadSlots(); }
          else if (r.body && r.body.error === 'validation.error') { formError('err_phone'); }
          else { formError('err_generic'); }
        }).catch(function () { btn.disabled = false; btn.textContent = old; formError('err_generic'); });
      });
    }).catch(function () { hide('state-loading'); show('state-notfound'); });
  });
})();
