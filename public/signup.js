/* Clinic signup client — served same-origin; CSP script-src 'self' friendly.
   Lang/theme pre-paint + header switchers come from site.js (shared with
   book.html and the marketing site's dc-lang/dc-theme persistence). */
(function () {
  'use strict';

  var de = document.documentElement;

  document.addEventListener('DOMContentLoaded', function () {
    var T = {
      en: {
        doc_title: 'Create your clinic', kicker: 'Get started',
        title: 'Create your clinic',
        lede: '30-day free trial \u00b7 full features \u00b7 no card required',
        clinic_name: 'Clinic name', subdomain: 'Clinic address (booking link)',
        name: 'Your full name', email: 'Email (this will be your login)',
        phone: 'Phone (Algerian mobile)', password: 'Password', password2: 'Confirm password',
        create: 'Create my clinic', trial_note: 'trial starts immediately',
        err_generic: 'Something went wrong \u2014 please try again.',
        err_subdomain: 'That clinic address is already taken. Pick another.',
        err_email: 'An account with this email already exists. Sign in instead.',
        err_limit: 'Too many attempts from this network \u2014 try again in an hour.',
        err_match: 'Passwords do not match.', err_fields: 'Please fill every field.',
        err_slug: 'Clinic address: lowercase letters, numbers and hyphens only.',
        err_email_fmt: 'Please enter a valid email address.',
        err_phone: 'Enter a valid Algerian phone (e.g. 0549 468 120 or +213549468120).',
        err_pw: 'Password must be at least 8 characters.',
        sending: 'Creating\u2026', done_kicker: 'Welcome aboard',
        done_ready: 'Your clinic is ready. Sign in from the desktop app with:',
        done_clinic: 'Clinic', done_link: 'Booking link', done_trial: 'Trial ends',
        done_note: 'Download the desktop app from the website, sign in, and invite your team from the Staff page.',
        footer: 'clinic management \u00b7 hosted & secure',
        aria_theme: 'Switch color theme', aria_lang: 'Language'
      },
      fr: {
        doc_title: 'Cr\u00e9ez votre clinique', kicker: 'Commencer',
        title: 'Cr\u00e9ez votre clinique',
        lede: 'Essai gratuit 30 jours \u00b7 toutes les fonctionnalit\u00e9s \u00b7 sans carte bancaire',
        clinic_name: 'Nom du cabinet', subdomain: 'Adresse du cabinet (lien de r\u00e9servation)',
        name: 'Votre nom complet', email: 'E-mail (votre identifiant de connexion)',
        phone: 'T\u00e9l\u00e9phone (mobile alg\u00e9rien)', password: 'Mot de passe', password2: 'Confirmer le mot de passe',
        create: 'Cr\u00e9er mon cabinet', trial_note: 'essai imm\u00e9diat',
        err_generic: 'Une erreur est survenue \u2014 r\u00e9essayez.',
        err_subdomain: 'Cette adresse de cabinet est d\u00e9j\u00e0 prise. Choisissez-en une autre.',
        err_email: 'Un compte existe d\u00e9j\u00e0 avec cet e-mail. Connectez-vous.',
        err_limit: 'Trop de tentatives depuis ce r\u00e9seau \u2014 r\u00e9essayez dans une heure.',
        err_match: 'Les mots de passe ne correspondent pas.', err_fields: 'Veuillez remplir tous les champs.',
        err_slug: 'Adresse du cabinet : lettres minuscules, chiffres et tirets uniquement.',
        err_email_fmt: 'Veuillez saisir une adresse e-mail valide.',
        err_phone: 'Saisissez un t\u00e9l\u00e9phone alg\u00e9rien valide (ex. 0549 468 120 ou +213549468120).',
        err_pw: 'Le mot de passe doit contenir au moins 8 caract\u00e8res.',
        sending: 'Cr\u00e9ation\u2026', done_kicker: 'Bienvenue',
        done_ready: 'Votre cabinet est pr\u00eat. Connectez-vous depuis l\u2019application avec :',
        done_clinic: 'Cabinet', done_link: 'Lien de r\u00e9servation', done_trial: 'Fin de l\u2019essai',
        done_note: 'T\u00e9l\u00e9chargez l\u2019application depuis le site, connectez-vous, puis invitez votre \u00e9quipe depuis la page Personnel.',
        footer: 'gestion de cabinet \u00b7 h\u00e9berg\u00e9 & s\u00e9curis\u00e9',
        aria_theme: 'Changer de th\u00e8me', aria_lang: 'Langue'
      },
      ar: {
        doc_title: 'أنشئ عيادتك', kicker: 'ابدأ الآن',
        title: 'أنشئ عيادتك',
        lede: 'تجربة مجانية 30 يوماً · كل الميزات · بدون بطاقة بنكية',
        clinic_name: 'اسم العيادة', subdomain: 'عنوان العيادة (رابط الحجز)',
        name: 'اسمك الكامل', email: 'البريد الإلكتروني (سيكون اسم دخولك)',
        phone: 'الهاتف (محرك جزائري)', password: 'كلمة المرور', password2: 'تأكيد كلمة المرور',
        create: 'أنشئ عيادتي', trial_note: 'تبدأ التجربة فوراً',
        err_generic: 'حدث خطأ ما — حاول مجدداً.',
        err_subdomain: 'عنوان العيادة محجوز مسبقاً. اختر غيره.',
        err_email: 'يوجد حساب بهذا البريد الإلكتروني مسبقاً. سجّل الدخول.',
        err_limit: 'محاولات كثيرة من هذه الشبكة — أعد المحاولة بعد ساعة.',
        err_match: 'كلمتا المرور غير متطابقتين.', err_fields: 'يرجى ملء جميع الحقول.',
        err_slug: 'عنوان العيادة: حروف صغيرة وأرقام وشرطات فقط.',
        err_email_fmt: 'يرجى إدخال بريد إلكتروني صحيح.',
        err_phone: 'أدخل رقم هاتف جزائري صالح (مثل 0549 468 120 أو +213549468120).',
        err_pw: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
        sending: 'جارٍ الإنشاء…', done_kicker: 'مرحباً بكم',
        done_ready: 'عيادتك جاهزة. سجّل الدخول من تطبيق سطح المكتب باستخدام:',
        done_clinic: 'العيادة', done_link: 'رابط الحجز', done_trial: 'نهاية التجربة',
        done_note: 'نزّل تطبيق سطح المكتب من الموقع، سجّل الدخول، ثم ادعُ فريقك من صفحة الموظفين.',
        footer: 'إدارة العيادات · مستضافة وآمنة',
        aria_theme: 'تبديل المظهر', aria_lang: 'اللغة'
      }
    };

    var $ = function (id) { return document.getElementById(id); };
    var flow = $('flow'), done = $('done');

    // Booking link base derived from the real origin, not a hardcoded domain
    // (so it stays correct across hosted domains, dev, and clean URLs).
    var bookBase = window.location.origin + '/book/';
    var bookBaseEl = $('bookBase');
    if (bookBaseEl) bookBaseEl.textContent = bookBase;

    function t(k) { var l = SITE.lang; return (T[l] && T[l][k]) || T.en[k] || k; }

    function applyLang() {
      de.setAttribute('lang', SITE.lang);
      de.setAttribute('dir', SITE.lang === 'ar' ? 'rtl' : 'ltr');
      document.title = 'Sera \u2014 ' + t('doc_title');
      document.querySelectorAll('[data-i]').forEach(function (el) {
        el.textContent = t(el.getAttribute('data-i'));
      });
      document.querySelectorAll('.lang-btn').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-l') === SITE.lang);
      });
      $('themeBtn').setAttribute('aria-label', t('aria_theme'));
    }

    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { SITE.setLang(b.getAttribute('data-l'), applyLang); });
    });

    SITE.wireControls(applyLang);

    // live slug preview: lowercase, keep [a-z0-9-], collapse repeats
    var subdomain = $('subdomain');
    var slugPreview = $('slugPreview');
    subdomain.addEventListener('input', function () {
      var v = subdomain.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 63);
      if (v !== subdomain.value) subdomain.value = v;
      slugPreview.textContent = v || 'your-clinic';
      subdomain.classList.remove('bad');
    });

    var formErr = $('formErr');
    function showError(msgKey) {
      formErr.textContent = t(msgKey);
      formErr.classList.remove('hidden');
    }

    var submitBtn = $('submitBtn');
    submitBtn.addEventListener('click', function () {
      formErr.classList.add('hidden');
      ['clinicName', 'subdomain', 'fullName', 'email', 'phone', 'password', 'password2']
        .forEach(function (id) { $(id).classList.remove('bad'); });

      var clinicName = $('clinicName').value.trim();
      var slug = subdomain.value.trim();
      var fullName = $('fullName').value.trim();
      var email = $('email').value.trim().toLowerCase();
      var phoneRaw = $('phone').value;
      var phone = normalizeDZPhone(phoneRaw);
      var password = $('password').value;
      var password2 = $('password2').value;

      if (!clinicName || !slug || !fullName || !email || !phone || !password || !password2) {
        return showError('err_fields');
      }
      if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) { subdomain.classList.add('bad'); return showError('err_slug'); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('email').classList.add('bad'); return showError('err_email_fmt'); }
      if (!phone) { $('phone').classList.add('bad'); return showError('err_phone'); }
      if (password.length < 8) { $('password').classList.add('bad'); return showError('err_pw'); }
      if (password !== password2) { $('password').classList.add('bad'); $('password2').classList.add('bad'); return showError('err_match'); }

      submitBtn.disabled = true;
      submitBtn.textContent = t('sending');

      fetch('/api/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_name: clinicName, subdomain: slug, full_name: fullName,
          email: email, phone: phone, password: password,
        }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          return { ok: r.ok, status: r.status, body: body };
        });
      }).then(function (res) {
        if (res.ok) {
          $('doneEmail').textContent = email;
          $('doneClinic').textContent = res.body.tenant.name;
          $('doneSlug').textContent = bookBase + '?clinic=' + res.body.tenant.subdomain;
          $('doneTrial').textContent = new Date(res.body.trial_ends_at)
            .toLocaleDateString(SITE.lang === 'ar' ? 'ar-DZ' : (SITE.lang === 'fr' ? 'fr-FR' : 'en-GB'));
          flow.classList.add('hidden');
          done.classList.remove('hidden');
          return;
        }
        var key = 'err_generic';
        if (res.status === 409 && res.body.error === 'signup.error.subdomain_taken') key = 'err_subdomain';
        else if (res.status === 409 && res.body.error === 'signup.error.email_taken') key = 'err_email';
        else if (res.status === 429) key = 'err_limit';
        showError(key);
      }).catch(function () {
        showError('err_generic');
      }).finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = t('create');
      });
    });

    // enter key submits
    ['clinicName', 'subdomain', 'fullName', 'email', 'phone', 'password', 'password2'].forEach(function (id) {
      $(id).addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitBtn.click();
      });
    });

    applyLang();
  });
})();
