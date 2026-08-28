(function () {
  document.querySelectorAll('[data-brand]').forEach(function (el) { el.textContent = window.APP_NAME; });

  // ---- Theme -------------------------------------------------------------
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem('dc-theme'); } catch (_) {}
  var prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  root.setAttribute('data-theme', saved || (prefersLight ? 'light' : 'dark'));

  document.getElementById('themeToggle').addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('dc-theme', next); } catch (_) {}
  });

  // ---- Scroll reveal -----------------------------------------------------
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
  }

  // ---- Interactive app preview: sidebar tabs switch panels ---------------
  var tabs = document.querySelectorAll('.app-side .side-item');
  var panels = document.querySelectorAll('.app-panel');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var page = tab.getAttribute('data-page');
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      panels.forEach(function (p) {
        p.classList.toggle('visible', p.getAttribute('data-panel') === page);
        // restart row entrance animations on each switch
        if (p.classList.contains('visible')) {
          p.querySelectorAll('.lrow, .app-card').forEach(function (el) {
            el.style.animation = 'none';
            void el.offsetWidth; // reflow
            el.style.animation = '';
          });
        }
      });
    });
  });

  // ---- Interactive month calendar (mirrors the desktop MonthView: --------
  // primary tint scales with appointment count, today highlighted,
  // non-work days dimmed, click a day -> day view)
    var grid = document.getElementById('apptGrid');
  var monthView = document.getElementById('apptMonthView');
  var dayView = document.getElementById('apptDayView');
  if (grid && monthView && dayView) {
    // August 2026 — Algerian workweek Sun–Thu, so Fri/Sat are off.
    // Aug 1 2026 is a Saturday -> 5 leading blanks on a Mon-first grid.
    var COUNTS = {2:6,3:9,4:11,5:7,6:12,9:8,10:10,11:13,12:6,13:9,16:7,17:12,18:9,19:14,20:8,23:10,24:14,25:11,26:9,27:12,30:8,31:5};
    var OFF = [1,7,8,14,15,21,22,28,29];
    var TODAY = 24;
    var LEADING_BLANKS = 5;

    function apptRow(a) {
      return '<div class="row"><i style="background:' + a[3] + '"></i><b>' + a[0] +
             '</b> ' + a[1] + ' <em>' + a[2] + '</em></div>';
    }

    var SAMPLE_APPTS = {
      24: [['09:00','Amina B. — Cleaning','done','var(--success)'],
           ['09:45','Yacine M. — Filling','in chair','var(--confirmed)'],
           ['10:30','Soraya K. — Checkup','waiting','var(--warning)'],
           ['11:15','Omar T. — Root canal','scheduled','var(--scheduled)'],
           ['12:00','Nadia R. — Consultation','scheduled','var(--border)']],
      19: [['09:00','Karim A. — Extraction','done','var(--success)'],
           ['10:00','Lina H. — Whitening','done','var(--success)'],
           ['11:30','Mehdi S. — Brace check','scheduled','var(--scheduled)']]
    };
    var DEFAULT_APPTS = [
      ['09:00','General consultation','scheduled','var(--scheduled)'],
      ['10:15','Scaling & polishing','scheduled','var(--confirmed)'],
      ['11:00','Follow-up visit','scheduled','var(--border)']
    ];

    var currentOpenDay = null;
    function openDay(day) {
      currentOpenDay = day;
      var date = new Date(2026, 7, day);
      var locale = LANG === 'ar' ? 'ar-DZ' : (LANG === 'fr' ? 'fr-FR' : 'en-US');
      var label = date.toLocaleDateString(locale, { weekday: 'short' }) + ' ' + day;
      document.getElementById('apptDayTitle').textContent = label;
      var list = SAMPLE_APPTS[day] || DEFAULT_APPTS;
      document.getElementById('apptDayCount').textContent = list.length + ' ' + MOCK[LANG].appts;
      document.getElementById('apptDayRows').innerHTML = list.map(apptRow).join('');
      monthView.hidden = true;
      dayView.hidden = false;
    }

    document.getElementById('apptBack').addEventListener('click', function () {
      dayView.hidden = true;
      monthView.hidden = false;
    });

    for (var b = 0; b < LEADING_BLANKS; b++) {
      grid.appendChild(document.createElement('span'));
    }
    for (var d = 1; d <= 31; d++) {
      (function (day) {
        var off = OFF.indexOf(day) >= 0;
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cal-cell' + (off ? ' off' : '') + (day === TODAY ? ' today' : '');
        // tint intensity follows the desktop's factor = min(count/5, 1)/5 mix
        var tint = Math.min(COUNTS[day] || 0, 5) / 5 * 0.16;
        if (tint > 0) cell.style.background = 'rgba(59,130,246,' + tint.toFixed(2) + ')';
        cell.innerHTML = '<span class="cnt">' + (COUNTS[day] || 0) + '</span><span>' + day + '</span>';
        if (!off) cell.addEventListener('click', function () { openDay(day); });
        else cell.setAttribute('aria-disabled', 'true');
        grid.appendChild(cell);
      })(d);
    }
  }

  // ---- Scroll: progress bar, nav elevation --------------------------------
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var bar = document.getElementById('progressBar');
  var navEl = document.querySelector('.nav');
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      navEl.classList.toggle('scrolled', y > 10);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Download button hrefs are stamped at package time by package-backend.ps1
  // (constant name: Sera-Bootstrapper.exe → stable /releases/latest/download/ URL),
  // so no runtime cross-origin fetch is needed.
  // (A previous best-effort version.json fetch was removed: GitHub release
  //  download endpoints don't send Access-Control-Allow-Origin, blocking it.)

  // ---- i18n: English / Français / العربية (RTL) ---------------------------
  var I18N = {
    en: {
      _dir: 'ltr', _flag: 'icons/flag-us.svg',
      'doc.title.sub': 'Dental Clinic Management',
      'nav.features': 'Features', 'nav.how': 'How it works', 'nav.pricing': 'Pricing', 'nav.faq': 'FAQ',
      'nav.cta': 'Get started',
      'hero.eyebrow': 'For modern dental clinics',
      'hero.h1': 'Run your entire clinic<br>from <mark>one screen.</mark>',
      'hero.lede': 'Scheduling, patient records, billing, inventory and analytics \u2014 purpose-built for dental practices. Hosted securely with automatic nightly backups \u2014 and the desktop app keeps working even when your connection drops.',
      'hero.dl': 'Download for Windows', 'hero.pricing': 'View pricing',
      'meta.0': 'Free 30-day trial', 'meta.1': 'Windows 10 / 11', 'meta.2': 'SHA-256 verified installer',
      'feat.head': 'Everything a clinic needs.<br>Nothing it doesn\u2019t.', 'feat.sub': 'One focused product instead of a dozen disconnected tools.',
      'feat.t.0': 'Smart scheduling', 'feat.d.0': 'Day, week and month views with drag-and-drop rescheduling, overlap detection and automatic reminders.',
      'feat.t.1': 'Dental chart & records', 'feat.d.1': 'Interactive odontogram with FDI numbering, treatment history, X-ray gallery and prescriptions in one patient file.',
      'feat.t.2': 'Billing & payments', 'feat.d.2': 'Invoices with line items, partial payments, status tracking and money-integrity checks you never have to think about.',
      'feat.t.3': 'Inventory & suppliers', 'feat.d.3': 'Stock levels, low-stock alerts, purchase orders and receiving \u2014 linked directly to treatments and expenses.',
      'feat.t.4': 'Offline-first', 'feat.d.4': 'Internet down mid-day? Keep working. Every change queues locally and replays automatically once you reconnect.',
      'feat.t.5': 'Trilingual, RTL included', 'feat.d.5': 'Full English, French and Arabic interfaces \u2014 switch instantly, right-to-left included, for every user on every screen.',
      'how.head': 'Up and running in minutes', 'how.sub': 'The installer does the heavy lifting \u2014 no IT department required.',
      'how.t.0': 'Download the installer', 'how.d.0': 'A tiny native launcher \u2014 verified with SHA-256 before it runs anything.',
      'how.t.1': 'Run the installer', 'how.d.1': 'The desktop app connects to Sera\u2019s secure cloud \u2014 your data lives on hosted servers with automatic backups. Nothing to install or maintain.',
      'how.t.2': 'Sign in and go', 'how.d.2': 'Create your clinic, invite your team, start booking patients. Nightly backups are scheduled for you.',
      'pr.head': 'Simple pricing, in dinars', 'pr.sub': 'Per clinic, per month. Cancel anytime.',
      'pr.badge': 'Most clinics choose this', 'pr.note': 'Every plan starts with a free 30-day trial \u2014 full features, no card required.',
      'pr.per': 'DA / month', 'pr.custom': 'Custom',
      'pr.name.0': 'Starter', 'pr.for.0': 'Single-dentist practices getting started.',
      'pr.li.0': ['1 practitioner, up to 3 staff accounts', 'Scheduling, patients & billing', 'Local data storage', 'Email support'],
      'pr.name.1': 'Clinic', 'pr.for.1': 'Growing practices with a full team.',
      'pr.li.1': ['Unlimited practitioners & staff', 'All modules incl. inventory & reports', 'Offline mode + automatic nightly backups', 'Audit log & role-based permissions', 'Priority support'],
      'pr.name.2': 'Enterprise', 'pr.for.2': 'Multi-site groups and chains.',
      'pr.li.2': ['Multiple clinics, consolidated reporting', 'Dedicated onboarding & data migration', 'Custom SLA'],
      'pricing.trial': 'Start free trial', 'pricing.talk': 'Talk to us',
      'faq.head': 'Frequently asked',
      'faq.q.0': 'Where does my data live?', 'faq.a.0': 'On Sera\u2019s secured servers, isolated per clinic and backed up automatically every night. Your clinic\u2019s data is never shared with other clinics, and you can export it at any time.',
      'faq.q.1': 'What happens if the internet goes out?', 'faq.a.1': 'Nothing dramatic. The app keeps working fully offline; changes made while disconnected are queued safely and replayed automatically in order when the connection returns.',
      'faq.q.2': 'Which platforms are supported?', 'faq.a.2': 'Windows 10 and 11 (64-bit). The backend runs on Sera\u2019s hosted servers \u2014 there is no server component to install.',
      'faq.q.3': 'How does the trial work?', 'faq.a.3': 'Download the installer, install, sign in. You get 30 days with every feature unlocked \u2014 no credit card. Keep using the Starter or Clinic plan afterwards.',
      'faq.q.4': 'Can my team use it at the same time?', 'faq.a.4': 'Yes. Role-based accounts (admin, dentist, receptionist) work concurrently, and every sensitive action is recorded in a tamper-evident audit log.',
      'cta.head': 'Your clinic deserves better software.', 'cta.sub': 'Install in minutes. Try everything for 30 days.', 'cta.btn': 'Download the installer',
      'footer.copy': '\u00A9 2026 SDIDSA. All rights reserved. \u2014 Designed & built in Algiers.', 'footer.contact': 'Contact',
      'aria.theme': 'Switch color theme', 'aria.lang': 'Language'
    },
    fr: {
      _dir: 'ltr', _flag: 'icons/flag-fr.svg',
      'doc.title.sub': 'Gestion de cabinet dentaire',
      'nav.features': 'Fonctionnalit\u00E9s', 'nav.how': 'Installation', 'nav.pricing': 'Tarifs', 'nav.faq': 'FAQ',
      'nav.cta': 'Commencer',
      'hero.eyebrow': 'Pour les cliniques dentaires modernes',
      'hero.h1': 'G\u00E9rez toute votre clinique<br>depuis <mark>un seul \u00E9cran.</mark>',
      'hero.lede': 'Planning, dossiers patients, facturation, stocks et statistiques \u2014 conçu pour les cabinets dentaires. Hébergement sécurisé avec sauvegardes automatiques chaque nuit \u2014 et l\u2019application reste utilisable même sans connexion.',
      'hero.dl': 'T\u00E9l\u00E9charger pour Windows', 'hero.pricing': 'Voir les tarifs',
      'meta.0': 'Essai gratuit de 30 jours', 'meta.1': 'Windows 10 / 11', 'meta.2': 'Programme d\u2019installation v\u00E9rifi\u00E9 SHA-256',
      'feat.head': 'Tout ce dont une clinique a besoin.<br>Rien de superflu.', 'feat.sub': 'Un produit unique au lieu d\u2019une dizaine d\u2019outils d\u00E9connect\u00E9s.',
      'feat.t.0': 'Planification intelligente', 'feat.d.0': 'Vues jour, semaine et mois avec replanification par glisser-d\u00E9poser, d\u00E9tection des chevauchements et rappels automatiques.',
      'feat.t.1': 'Odontogramme & dossiers', 'feat.d.1': 'Odontogramme interactif (num\u00E9rotation FDI), historique des traitements, radiographies et ordonnances dans un dossier patient unique.',
      'feat.t.2': 'Facturation & paiements', 'feat.d.2': 'Factures avec lignes d\u00E9taill\u00E9es, paiements partiels, suivi des statuts et contr\u00F4les d\u2019int\u00E9grit\u00E9 automatiques.',
      'feat.t.3': 'Stocks & fournisseurs', 'feat.d.3': 'Niveaux de stock, alertes de seuil, bons de commande et r\u00E9ception \u2014 li\u00E9s aux traitements et aux d\u00E9penses.',
      'feat.t.4': 'Hors ligne d\u2019abord', 'feat.d.4': 'Une coupure Internet en pleine journ\u00E9e ? Continuez \u00E0 travailler. Chaque modification est mise en file locale puis rejou\u00E9e automatiquement au retour du r\u00E9seau.',
      'feat.t.5': 'Trilingue, RTL inclus', 'feat.d.5': 'Interfaces compl\u00E8tes en anglais, fran\u00E7ais et arabe \u2014 basculez instantan\u00E9ment, droite-\u00E0-gauche comprise, pour chaque utilisateur sur chaque \u00E9cran.',
      'how.head': 'Op\u00E9rationnel en quelques minutes', 'how.sub': 'Le programme d\u2019installation fait le gros du travail \u2014 sans service informatique.',
      'how.t.0': 'T\u00E9l\u00E9chargez le programme d\u2019installation', 'how.d.0': 'Un petit lanceur natif \u2014 v\u00E9rifi\u00E9 par SHA-256 avant d\u2019ex\u00E9cuter quoi que ce soit.',
      'how.t.1': 'Lancez l\u2019installateur', 'how.d.1': 'L\u2019application se connecte au cloud s\u00E9curis\u00E9 de Sera \u2014 vos donn\u00E9es r\u00E9sident sur des serveurs h\u00E9berg\u00E9s avec sauvegardes automatiques. Rien \u00E0 installer ni \u00E0 maintenir.',
      'how.t.2': 'Connectez-vous, c\u2019est parti', 'how.d.2': 'Cr\u00E9ez votre clinique, invitez votre \u00E9quipe, planifiez vos premiers patients. Les sauvegardes nocturnes sont programm\u00E9es pour vous.',
      'pr.head': 'Tarification simple, en dinars', 'pr.sub': 'Par clinique, par mois. Sans engagement.',
      'pr.badge': 'Le choix de la plupart des cliniques', 'pr.note': 'Chaque formule commence par un essai gratuit de 30 jours \u2014 toutes les fonctionnalit\u00E9s, sans carte bancaire.',
      'pr.per': 'DA / mois', 'pr.custom': 'Sur mesure',
      'pr.name.0': 'Starter', 'pr.for.0': 'Cabinets mono-praticien qui d\u00E9marrent.',
      'pr.li.0': ['1 praticien, jusqu\u2019\u00E0 3 comptes staff', 'Planning, patients & facturation', 'Stockage local des donn\u00E9es', 'Support par e-mail'],
      'pr.name.1': 'Clinique', 'pr.for.1': 'Cabinets en croissance avec une \u00E9quipe compl\u00E8te.',
      'pr.li.1': ['Praticiens et staff illimit\u00E9s', 'Tous les modules : stocks & rapports', 'Mode hors ligne + sauvegardes nocturnes auto', 'Journal d\u2019audit & permissions par r\u00F4le', 'Support prioritaire'],
      'pr.name.2': 'Enterprise', 'pr.for.2': 'Groupes et r\u00E9seaux multi-sites.',
      'pr.li.2': ['Cliniques multiples, rapports consolid\u00E9s', 'Onboarding d\u00E9di\u00E9 & migration des donn\u00E9es', 'SLA personnalis\u00E9'],
      'pricing.trial': 'Essai gratuit', 'pricing.talk': 'Nous contacter',
      'faq.head': 'Questions fr\u00E9quentes',
      'faq.q.0': 'O\u00F9 sont h\u00E9berg\u00E9es mes donn\u00E9es ?', 'faq.a.0': 'Sur des serveurs sécurisés, isolés par clinique et sauvegardés automatiquement chaque nuit. Les données de votre cabinet ne sont jamais partagées avec d\u2019autres cliniques, et vous pouvez les exporter à tout moment.',
      'faq.q.1': 'Que se passe-t-il si Internet tombe ?', 'faq.a.1': 'Rien de dramatique. L\u2019application continue de fonctionner hors ligne ; les modifications effectu\u00E9es sont mises en file d\u2019attente puis rejou\u00E9es automatiquement dans l\u2019ordre au retour de la connexion.',
      'faq.q.2': 'Quelles plateformes sont prises en charge ?', 'faq.a.2': 'Windows 10 et 11 (64 bits). Le serveur tourne dans le cloud de Sera : aucun composant serveur \u00E0 installer.',
      'faq.q.3': 'Comment fonctionne l\u2019essai ?', 'faq.a.3': 'T\u00E9l\u00E9chargez le programme d\u2019installation, installez, connectez-vous. Vous disposez de 30 jours avec toutes les fonctionnalit\u00E9s d\u00E9bloqu\u00E9es \u2014 sans carte bancaire. Passez ensuite \u00E0 la formule Starter ou Clinique.',
      'faq.q.4': 'Mon \u00E9quipe peut-elle l\u2019utiliser simultan\u00E9ment ?', 'faq.a.4': 'Oui. Les comptes par r\u00F4le (admin, dentiste, secr\u00E9taire) fonctionnent en parall\u00E8le, et chaque action sensible est consign\u00E9e dans un journal d\u2019audit infalsifiable.',
      'cta.head': 'Votre clinique m\u00E9rite un meilleur logiciel.', 'cta.sub': 'Install\u00E9 en minutes. Tout \u00E0 essayer pendant 30 jours.', 'cta.btn': 'T\u00E9l\u00E9charger le programme d\u2019installation',
      'footer.copy': '\u00A9 2026 SDIDSA. Tous droits r\u00E9serv\u00E9s. \u2014 Con\u00E7u et d\u00E9velopp\u00E9 \u00E0 Alger.', 'footer.contact': 'Contact',
      'aria.theme': 'Changer de th\u00E8me', 'aria.lang': 'Langue'
    },
    ar: {
      _dir: 'rtl', _flag: 'icons/flag-dz.svg',
      'doc.title.sub': '\u0625\u062F\u0627\u0631\u0629 \u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0633\u0646\u0627\u0646',
      'nav.features': '\u0627\u0644\u0645\u064A\u0632\u0627\u062A', 'nav.how': '\u0643\u064A\u0641\u064A\u0629 \u0627\u0644\u062A\u062B\u0628\u064A\u062A', 'nav.pricing': '\u0627\u0644\u0623\u0633\u0639\u0627\u0631', 'nav.faq': '\u0623\u0633\u0626\u0644\u0629 \u0634\u0627\u0626\u0629',
      'nav.cta': '\u0627\u0628\u062F\u0623 \u0627\u0644\u0622\u0646',
      'hero.eyebrow': '\u0644\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0633\u0646\u0627\u0646 \u0627\u0644\u062D\u062F\u064A\u062B\u0629',
      'hero.h1': '\u0623\u062F\u0631 \u0639\u064A\u0627\u062F\u062A\u0643 \u0628\u0627\u0644\u0643\u0627\u0645\u0644<br>\u0645\u0646 <mark>\u0634\u0627\u0634\u0629 \u0648\u0627\u062D\u062F\u0629.</mark>',
      'hero.lede': 'المواعيد، سجلات المرضى، الفواتير، المخزون والإحصائيات \u2014 مصمم خصيصاً لعيادات الأسنان. استضافة آمنة مع نسخ احتياطية تلقائية كل ليلة \u2014 ويظل التطبيق يعمل حتى دون اتصال.',
      'hero.dl': '\u062A\u062D\u0645\u064A\u0644 \u0644\u0646\u0638\u0627\u0645 Windows', 'hero.pricing': '\u0639\u0631\u0636 \u0627\u0644\u0623\u0633\u0639\u0627\u0631',
      'meta.0': '\u062A\u062C\u0631\u0628\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 30 \u064A\u0648\u0645\u0627\u064B', 'meta.1': 'Windows 10 / 11', 'meta.2': '\u0645\u062B\u0628\u0651\u062A \u0645\u0648\u0642\u0651\u0639 SHA-256',
      'feat.head': '\u0643\u0644 \u0645\u0627 \u062A\u062D\u062A\u0627\u062C\u0647 \u0627\u0644\u0639\u064A\u0627\u062F\u0629.<br>\u0648\u0644\u0627 \u0634\u064A\u0621 \u0632\u0627\u0626\u062F.', 'feat.sub': '\u0645\u0646\u062A\u062C \u0648\u0627\u062D\u062F \u0645\u0631\u0643\u0651\u0632 \u0628\u062F\u0644\u0627\u064B \u0645\u0646 \u0639\u0634\u0631\u0629 \u0623\u062F\u0648\u0627\u062A \u0645\u0646\u0641\u0635\u0644\u0629.',
      'feat.t.0': '\u062C\u062F\u0648\u0644\u0629 \u0630\u0643\u064A\u0629', 'feat.d.0': '\u0639\u0631\u0636 \u064A\u0648\u0645\u064A \u0648\u0623\u0633\u0628\u0648\u0639\u064A \u0648\u0634\u0647\u0631\u064A \u0645\u0639 \u0627\u0644\u0633\u062D\u0628 \u0648\u0627\u0644\u0625\u0641\u0644\u0627\u062A\u060C \u0648\u0627\u0643\u062A\u0634\u0627\u0641 \u0627\u0644\u062A\u0639\u0627\u0631\u0636\u0627\u062A\u060C \u0648\u062A\u0630\u0643\u064A\u0631\u0627\u062A \u062A\u0644\u0642\u0627\u0626\u064A\u0629.',
      'feat.t.1': '\u0645\u062E\u0637\u0637 \u0627\u0644\u0623\u0633\u0646\u0627\u0646 \u0648\u0627\u0644\u0633\u062C\u0644\u0627\u062A', 'feat.d.1': '\u0631\u0633\u0645 \u062A\u0641\u0627\u0639\u0644\u064A \u0628\u062A\u0631\u0642\u064A\u0645 FDI\u060C \u0633\u062C\u0644 \u0627\u0644\u0639\u0644\u0627\u062C\u0627\u062A\u060C \u0645\u0639\u0631\u0636 \u0627\u0644\u0623\u0634\u0639\u0629 \u0648\u0627\u0644\u0648\u0635\u0641\u0627\u062A \u0641\u064A \u0645\u0644\u0641 \u0645\u0631\u064A\u0636 \u0648\u0627\u062D\u062F.',
      'feat.t.2': '\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631 \u0648\u0627\u0644\u062F\u0641\u0639\u0627\u062A', 'feat.d.2': '\u0641\u0648\u0627\u062A\u064A\u0631 \u0628\u0628\u0646\u0648\u062F \u0645\u0641\u0635\u0651\u0644\u0629\u060C \u062F\u0641\u0639\u0627\u062A \u062C\u0632\u0626\u064A\u0629\u060C \u062A\u062A\u0628\u0651\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0648\u0641\u062D\u0648\u0635\u0627\u062A \u0633\u0644\u0627\u0645\u0629 \u0645\u0627\u0644\u064A\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u0629.',
      'feat.t.3': '\u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u0645\u0648\u0631\u062F\u0648\u0646', 'feat.d.3': '\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646\u060C \u062A\u0646\u0628\u064A\u0647\u0627\u062A \u0627\u0644\u0646\u0642\u0635\u060C \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u2014 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0627\u0644\u0639\u0644\u0627\u062C\u0627\u062A \u0648\u0627\u0644\u0645\u0635\u0627\u0631\u064A\u0641.',
      'feat.t.4': '\u064A\u0639\u0645\u0644 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 \u0623\u0648\u0644\u0627\u064B', 'feat.d.4': '\u0627\u0646\u0642\u0637\u0639 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0641\u064A \u0645\u0646\u062A\u0635\u0641 \u0627\u0644\u064A\u0648\u0645\u061F \u062A\u0627\u0628\u0639 \u0627\u0644\u0639\u0645\u0644. \u0643\u0644 \u062A\u0639\u062F\u064A\u0644 \u064A\u064F\u062D\u0641\u0638 \u0645\u062D\u0644\u064A\u0627\u064B \u0648\u064A\u064F\u0639\u0627\u062F \u0625\u0631\u0633\u0627\u0644\u0647 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0639\u0646\u062F \u0639\u0648\u062F\u0629 \u0627\u0644\u0634\u0628\u0643\u0629.',
      'feat.t.5': '\u062B\u0644\u0627\u062B \u0644\u063A\u0627\u062A \u0645\u0639 \u062F\u0639\u0645 RTL', 'feat.d.5': '\u0648\u0627\u062C\u0647\u0627\u062A \u0643\u0627\u0645\u0644\u0629 \u0628\u0627\u0644\u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0648\u0627\u0644\u0641\u0631\u0646\u0633\u064A\u0629 \u0648\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u2014 \u0628\u062F\u0651\u0644 \u0641\u0648\u0631\u0627\u064B\u060C \u0645\u0639 \u0627\u0644\u0643\u062A\u0627\u0628\u0629 \u0645\u0646 \u0627\u0644\u064A\u0645\u064A\u0646 \u0625\u0644\u0649 \u0627\u0644\u064A\u0633\u0627\u0631\u060C \u0644\u0643\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644 \u0634\u0627\u0634\u0629.',
      'how.head': '\u062C\u0627\u0647\u0632 \u0644\u0644\u0639\u0645\u0644 \u0641\u064A \u062F\u0642\u0627\u0626\u0642', 'how.sub': '\u0627\u0644\u0645\u062B\u0628\u0651\u062A \u064A\u0642\u0648\u0645 \u0628\u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0634\u0627\u0642 \u2014 \u062F\u0648\u0646 \u062D\u0627\u062C\u0629 \u0644\u0642\u0633\u0645 \u062A\u0642\u0646\u064A\u0629.',
      'how.t.0': '\u062D\u0645\u0651\u0644 \u0627\u0644\u0645\u062B\u0628\u0651\u062A', 'how.d.0': '\u0645\u0634\u063A\u0651\u0644 \u0623\u0635\u0644\u064A \u0635\u063A\u064A\u0631 \u2014 \u064A\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646\u0647 \u0639\u0628\u0631 SHA-256 \u0642\u0628\u0644 \u062A\u0634\u063A\u064A\u0644 \u0623\u064A \u0634\u064A\u0621.',
      'how.t.1': '\u0634\u063A\u0651\u0644 \u0627\u0644\u0645\u062B\u0628\u0651\u062A', 'how.d.1': '\u064A\u062A\u0635\u0644 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0628\u0633\u062D\u0627\u0628\u0629 Sera \u0627\u0644\u0622\u0645\u0646\u0629 \u2014 \u062A\u0628\u0642\u0649 \u0628\u064A\u0627\u0646\u0627\u062A\u0643 \u0639\u0644\u0649 \u062E\u062F\u0645\u0627\u062A \u0645\u0633\u062A\u0636\u0627\u0641\u0629 \u0645\u0639 \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B. \u0644\u0627 \u0634\u064A\u0621 \u0644\u0644\u062A\u062B\u0628\u064A\u062A \u0648\u0644\u0627 \u0644\u0644\u0635\u064A\u0627\u0646\u0629.',
      'how.t.2': '\u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0648\u0627\u0646\u0637\u0644\u0642', 'how.d.2': '\u0623\u0646\u0634\u0626 \u0639\u064A\u0627\u062F\u062A\u0643\u060C \u0627\u062F\u0639\u064F \u0641\u0631\u064A\u0642\u0643\u060C \u0627\u0628\u062F\u0623 \u0628\u062D\u062C\u0632 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F. \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u0644\u064A\u0644\u064A \u0645\u062C\u062F\u0648\u0644 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B.',
      'pr.head': '\u0623\u0633\u0639\u0627\u0631 \u0628\u0633\u064A\u0637\u0629\u060C \u0628\u0627\u0644\u062F\u064A\u0646\u0627\u0631', 'pr.sub': '\u0644\u0643\u0644 \u0639\u064A\u0627\u062F\u0629\u060C \u0634\u0647\u0631\u064A\u0627\u064B. \u0625\u0644\u063A\u0627\u0621 \u0641\u064A \u0623\u064A \u0648\u0642\u062A.',
      'pr.badge': '\u062E\u064A\u0627\u0631 \u0645\u0639\u0638\u0645 \u0627\u0644\u0639\u064A\u0627\u062F\u0627\u062A', 'pr.note': '\u0643\u0644 \u062E\u0637\u0629 \u062A\u0628\u062F\u0623 \u0628\u062A\u062C\u0631\u0628\u0629 \u0645\u062C\u0627\u0646\u064A\u0629 30 \u064A\u0648\u0645\u0627\u064B \u2014 \u0628\u0643\u0644 \u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0648\u062F\u0648\u0646 \u0628\u0637\u0627\u0642\u0629 \u0628\u0646\u0643\u064A\u0629.',
      'pr.per': '\u062F\u062C / \u0634\u0647\u0631', 'pr.custom': '\u062D\u0633\u0628 \u0627\u0644\u0637\u0644\u0628',
      'pr.name.0': 'Starter', 'pr.for.0': '\u0639\u064A\u0627\u062F\u0627\u062A \u0628\u0645\u0645\u0627\u0631\u0633 \u0648\u0627\u062D\u062F \u0641\u064A \u0628\u062F\u0627\u064A\u062A\u0647\u0627.',
      'pr.li.0': ['\u0645\u0645\u0627\u0631\u0633 \u0648\u0627\u062D\u062F \u0648\u062D\u062A\u0649 3 \u062D\u0633\u0627\u0628\u0627\u062A \u0645\u0648\u0638\u0641\u064A\u0646', '\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0648\u0627\u0644\u0645\u0631\u0636\u0649 \u0648\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631', '\u062A\u062E\u0632\u064A\u0646 \u0645\u062D\u0644\u064A \u0644\u0644\u0628\u064A\u0627\u0646\u0627\u062A', '\u062F\u0639\u0645 \u0639\u0628\u0631 \u0627\u0644\u0628\u0631\u064A\u062F'],
      'pr.name.1': 'Clinic', 'pr.for.1': '\u0627\u0644\u0639\u064A\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0627\u0645\u064A\u0629 \u0628\u0641\u0631\u064A\u0642 \u0643\u0627\u0645\u0644.',
      'pr.li.1': ['\u0645\u0645\u0627\u0631\u0633\u0648\u0646 \u0648\u0645\u0648\u0638\u0641\u0648\u0646 \u0628\u0644\u0627 \u062D\u062F\u0648\u062F', '\u0643\u0644 \u0627\u0644\u0648\u062D\u062F\u0627\u062A: \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0648\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631', '\u0648\u0636\u0639 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 + \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0644\u064A\u0644\u064A \u062A\u0644\u0642\u0627\u0626\u064A', '\u0633\u062C\u0644 \u062A\u062F\u0642\u064A\u0642 \u0648\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u062F\u0648\u0631', '\u062F\u0639\u0645 \u0623\u0648\u0644\u0648\u064A\u0629'],
      'pr.name.2': 'Enterprise', 'pr.for.2': '\u0627\u0644\u0645\u062C\u0645\u0648\u0639\u0627\u062A \u0645\u062A\u0639\u062F\u062F\u0629 \u0627\u0644\u0645\u0648\u0627\u0642\u0639.',
      'pr.li.2': ['\u0639\u064A\u0627\u062F\u0627\u062A \u0645\u062A\u0639\u062F\u062F\u0629 \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0645\u0648\u062D\u062F\u0629', '\u062A\u062F\u0631\u064A\u0628 \u0648\u0646\u0642\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u0635\u0635', 'SLA \u062D\u0633\u0628 \u0627\u0644\u0627\u062A\u0641\u0627\u0642'],
      'pricing.trial': '\u062A\u062C\u0631\u0628\u0629 \u0645\u062C\u0627\u0646\u064A\u0629', 'pricing.talk': '\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0646\u0627',
      'faq.head': '\u0623\u0633\u0626\u0644\u0629 \u0634\u0627\u0626\u0639\u0629',
      'faq.q.0': '\u0623\u064A\u0646 \u062A\u062A\u062E\u0632\u064A\u0646 \u0628\u064A\u0627\u0646\u0627\u062A\u064A\u061F', 'faq.a.0': 'على خوادم Sera المؤمنة، معزولة لكل عيادة ونسخ احتياطية تلقائية كل ليلة. لا تتم مشاركة بيانات عيادتك أبداً مع عيادات أخرى، ويمكنك تصديرها في أي وقت.',
      'faq.q.1': '\u0645\u0627\u0630\u0627 \u0644\u0648 \u0627\u0646\u0642\u0637\u0639 \u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A\u061F', 'faq.a.1': '\u0644\u0627 \u0634\u064A\u0621 \u0645\u062B\u064A\u0631. \u064A\u0633\u062A\u0645\u0631 \u0627\u0644\u062A\u0637\u0628\u064A\u0642 \u0641\u064A \u0627\u0644\u0639\u0645\u0644 \u062F\u0648\u0646 \u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0643\u0627\u0645\u0644\u061B \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A \u062A\u064F\u0631\u0627\u062A\u0628 \u0628\u0623\u0645\u0627\u0646 \u0648\u062A\u064F\u0639\u0627\u062F \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B \u0639\u0646\u062F \u0639\u0648\u062F\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644.',
      'faq.q.2': '\u0645\u0627 \u0627\u0644\u0645\u0646\u0635\u0627\u062A \u0627\u0644\u0645\u062F\u0639\u0648\u0645\u0629\u061F', 'faq.a.2': 'Windows 10 \u064811 (\u0646\u0638\u0627\u0645 64-bit). \u064A\u0639\u0645\u0644 \u0627\u0644\u062E\u0627\u062F\u0645 \u0639\u0644\u0649 \u062E\u062F\u0645\u0627\u062A Sera \u0627\u0644\u0645\u0633\u062A\u0636\u0627\u0641\u0629 \u2014 \u0644\u0627 \u064A\u0648\u062C\u062F \u0645\u0643\u0648\u0651\u0646 \u062E\u0627\u062F\u0645 \u0644\u0644\u062A\u062B\u0628\u064A\u062A.',
      'faq.q.3': '\u0643\u064A\u0641 \u062A\u0639\u0645\u0644 \u0627\u0644\u062A\u062C\u0631\u0628\u0629\u061F', 'faq.a.3': '\u062D\u0645\u0651\u0644 \u0627\u0644\u0645\u062B\u0628\u0651\u062A\u060C \u062B\u0628\u0651\u062A\u060C \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644. \u0644\u062F\u064A\u0643 30 \u064A\u0648\u0645\u0627\u064B \u0628\u0643\u0644 \u0627\u0644\u0645\u064A\u0632\u0627\u062A \u0645\u0641\u062A\u0648\u062D\u0629 \u2014 \u062F\u0648\u0646 \u0628\u0637\u0627\u0642\u0629 \u0628\u0646\u0643\u064A\u0629. \u0627\u062E\u062A\u0631 \u062E\u0637\u0629 Starter \u0623\u0648 Clinic \u0628\u0639\u062F\u0647\u0627.',
      'faq.q.4': '\u0647\u0644 \u064A\u0645\u0643\u0646 \u0644\u0641\u0631\u064A\u0642\u064A \u0627\u0633\u062A\u062E\u062F\u0627\u0645\u0647 \u0641\u064A \u0646\u0641\u0633 \u0627\u0644\u0648\u0642\u062A\u061F', 'faq.a.4': '\u0646\u0639\u0645. \u062D\u0633\u0627\u0628\u0627\u062A \u0628\u0623\u062F\u0648\u0627\u0631 \u0645\u062E\u062A\u0644\u0641\u0629 (\u0645\u062F\u064A\u0631\u060C \u0637\u0628\u064A\u0628\u060C \u0645\u0633\u062A\u0634\u0639\u0627\u0631) \u062A\u0639\u0645\u0644 \u0628\u0627\u0644\u062A\u0632\u0627\u0645\u0646\u060C \u0648\u0643\u0644 \u0625\u062C\u0631\u0627\u0621 \u062D\u0633\u0627\u0633 \u064A\u064F\u0633\u062C\u0644 \u0641\u064A \u0633\u062C\u0644 \u062A\u062F\u0642\u064A\u0642 \u0645\u0636\u0627\u062F \u0644\u0644\u062A\u0644\u0648\u062B.',
      'cta.head': '\u0639\u064A\u0627\u062F\u062A\u0643 \u062A\u0633\u062A\u062D\u0642 \u0628\u0631\u0645\u062C\u064A\u0627\u062A \u0623\u0641\u0636\u0644.', 'cta.sub': '\u0627\u0644\u062A\u062B\u0628\u064A\u062A \u0641\u064A \u062F\u0642\u0627\u0626\u0642. \u062C\u0631\u0651\u0628 \u0643\u0644 \u0634\u064A\u0621 \u0644\u0645\u062F\u0629 30 \u064A\u0648\u0645\u0627\u064B.', 'cta.btn': '\u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u062B\u0628\u0651\u062A',
      'footer.copy': '\u00A9 2026 SDIDSA. \u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0642 \u0645\u062D\u0641\u0648\u0638\u0629. \u2014 \u062A\u0635\u0645\u064A\u0645 \u0648\u062A\u0637\u0648\u064A\u0631 \u0641\u064A \u0627\u0644\u062C\u0632\u0627\u0626\u0631.', 'footer.contact': '\u0627\u062A\u0635\u0644 \u0628\u0646\u0627',
      'aria.theme': '\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0645\u0638\u0647\u0631', 'aria.lang': '\u0627\u0644\u0644\u063A\u0629'
    }
  };


  // ---- i18n engine --------------------------------------------------------
  var MOCK = {
    en: {
      tabs: { dashboard: 'Dashboard', appointments: 'Appointments', patients: 'Patients', billing: 'Billing', inventory: 'Inventory', settings: 'Settings' },
      kToday: 'Patients today', kRev: 'Revenue \u00B7 month', kSched: 'Today\u2019s schedule', wed: 'Wed 24',
      month: 'August 2026', monthPill: 'month',
      days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], appts: 'appts', apptList: 'Appointments',
      st: { done: 'done', chair: 'in chair', waiting: 'waiting', sched: 'scheduled' },
      tr: { cleaning: 'Cleaning', filling: 'Filling', checkup: 'Checkup', root: 'Root canal', consult: 'Consultation', scaling: 'Scaling & polishing', followup: 'Follow-up visit', extraction: 'Extraction', whitening: 'Whitening', brace: 'Brace check' },
      searchPh: 'Search patients\u2026', lastToday: 'Last visit \u00B7 today', last3: 'Last visit \u00B7 3 days ago', lastWeek: 'Last visit \u00B7 1 week ago', newPat: 'New patient',
      paid: 'paid', partial: 'partial', unpaid: 'unpaid',
      kOut: 'Outstanding', kCol: 'Collected \u00B7 month', low: 'low',
      dark: 'Dark appearance', rem: 'Appointment reminders', bak: 'Nightly backup', langLbl: 'Language'
    },
    fr: {
      tabs: { dashboard: 'Tableau de bord', appointments: 'Rendez-vous', patients: 'Patients', billing: 'Facturation', inventory: 'Stocks', settings: 'Param\u00E8tres' },
      kToday: 'Patients aujourd\u2019hui', kRev: 'Revenus \u00B7 mois', kSched: 'Planning du jour', wed: 'Mer. 24',
      month: 'Ao\u00FBt 2026', monthPill: 'mois',
      days: ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'], appts: 'rdv', apptList: 'Rendez-vous',
      st: { done: 'termin\u00E9', chair: 'au fauteuil', waiting: 'en salle', sched: 'planifi\u00E9' },
      tr: { cleaning: 'D\u00E9tartrage', filling: 'Obturation', checkup: 'Contr\u00F4le', root: 'Traitement canalaire', consult: 'Consultation', scaling: 'D\u00E9tartrage & polissage', followup: 'Visite de contr\u00F4le', extraction: 'Extraction', whitening: 'Blanchiment', brace: 'Contr\u00F4le appareil' },
      searchPh: 'Rechercher des patients\u2026', lastToday: 'Derni\u00E8re visite \u00B7 aujourd\u2019hui', last3: 'Derni\u00E8re visite \u00B7 il y a 3 jours', lastWeek: 'Derni\u00E8re visite \u00B7 il y a 1 semaine', newPat: 'Nouveau patient',
      paid: 'pay\u00E9e', partial: 'partielle', unpaid: 'impay\u00E9e',
      kOut: 'Encours', kCol: 'Encaiss\u00E9 \u00B7 mois', low: 'faible',
      dark: 'Apparence sombre', rem: 'Rappels de rendez-vous', bak: 'Sauvegarde nocturne', langLbl: 'Langue'
    },
    ar: {
      tabs: { dashboard: '\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629', appointments: '\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F', patients: '\u0627\u0644\u0645\u0631\u0636\u0649', billing: '\u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631', inventory: '\u0627\u0644\u0645\u062E\u0632\u0648\u0646', settings: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A' },
      kToday: '\u0645\u0631\u0636\u0649 \u0627\u0644\u064A\u0648\u0645', kRev: '\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u0647\u0631', kSched: '\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u064A\u0648\u0645', wed: '\u0623\u0631\u0628\u0639\u0627\u0621 24',
      month: '\u0623\u063A\u0633\u0637\u0633 2026', monthPill: '\u0634\u0647\u0631\u064A',
      days: ['\u0627\u062B\u0646\u064A\u0646','\u062B\u0644\u0627\u062B\u0627\u0621','\u0623\u0631\u0628\u0639\u0627\u0621','\u062E\u0645\u064A\u0633','\u062C\u0645\u0639\u0629','\u0633\u0628\u062A','\u0623\u062D\u062F'], appts: '\u0645\u0648\u0627\u0639\u064A\u062F', apptList: '\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F',
      st: { done: '\u0645\u0646\u062A\u0647\u064A', chair: '\u0641\u064A \u0627\u0644\u0643\u0631\u0633\u064A', waiting: '\u0628\u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631', sched: '\u0645\u0628\u0631\u0645\u062C' },
      tr: { cleaning: '\u062A\u0646\u0638\u064A\u0641', filling: '\u062D\u0634\u0648\u0629', checkup: '\u0641\u062D\u0635', root: '\u0639\u0644\u0627\u062C \u062C\u0630\u0648\u0631', consult: '\u0627\u0633\u062A\u0634\u0627\u0631\u0629', scaling: '\u062A\u0646\u0638\u064A\u0641 \u0648\u062A\u0644\u0645\u064A\u0639', followup: '\u0632\u064A\u0627\u0631\u0629 \u0645\u062A\u0627\u0628\u0639\u0629', extraction: '\u062E\u0644\u0639', whitening: '\u062A\u0628\u064A\u064A\u0636', brace: '\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u0642\u0648\u064A\u0645' },
      searchPh: '\u0627\u0628\u062D\u062B \u0639\u0646 \u0645\u0631\u064A\u0636\u2026', lastToday: '\u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629 \u00B7 \u0627\u0644\u064A\u0648\u0645', last3: '\u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629 \u00B7 \u0642\u0628\u0644 3 \u0623\u064A\u0627\u0645', lastWeek: '\u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629 \u00B7 \u0642\u0628\u0644 \u0623\u0633\u0628\u0648\u0639', newPat: '\u0645\u0631\u064A\u0636 \u062C\u062F\u064A\u062F',
      paid: '\u0645\u062F\u0641\u0648\u0639\u0629', partial: '\u062C\u0632\u0626\u064A\u0629', unpaid: '\u063A\u064A\u0631 \u0645\u062F\u0641\u0648\u0639\u0629',
      kOut: '\u0627\u0644\u0645\u062A\u0628\u0642\u064A', kCol: '\u0627\u0644\u0645\u062D\u0635\u0651\u0644 \u00B7 \u0634\u0647\u0631', low: '\u0645\u0646\u062E\u0641\u0636',
      dark: '\u0627\u0644\u0645\u0638\u0647\u0631 \u0627\u0644\u062F\u0627\u0643\u0646', rem: '\u062A\u0630\u0643\u064A\u0631\u0627\u062A \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F', bak: '\u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u0627\u0644\u0644\u064A\u0644\u064A', langLbl: '\u0627\u0644\u0644\u063A\u0629'
    }
  };

  var LANG = document.documentElement.getAttribute('data-lang') || 'en';
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  function applyLang(lang) {
    if (!I18N[lang]) lang = 'en';
    LANG = lang;
    var t = I18N[lang], m = MOCK[lang];

    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', t._dir);
    try { localStorage.setItem('dc-lang', lang); } catch (_) {}
    document.title = window.APP_NAME + ' \u2014 ' + t['doc.title.sub'];
    var md = $('meta[name="description"]'); if (md) md.setAttribute('content', t['hero.lede']);
    $('#langFlag').src = t._flag;
    $('#themeToggle').setAttribute('aria-label', t['aria.theme']);
    $('#langBtn').setAttribute('aria-label', t['aria.lang']);

    var navLinks = $$('.nav-links a');
    ['nav.features','nav.how','nav.pricing','nav.faq'].forEach(function (k, i) { navLinks[i].textContent = t[k]; });
    $$('[data-k]').forEach(function (el) { el.textContent = t[el.getAttribute('data-k')]; });

    $('.eyebrow').textContent = t['hero.eyebrow'];
    $('.hero-copy h1').innerHTML = t['hero.h1'];
    $('.lede').textContent = t['hero.lede'];
    $$('.hero-meta li').forEach(function (li, i) { li.textContent = t['meta.' + i]; });

    $('#features .section-head h2').innerHTML = t['feat.head'];
    $('#features .section-head p').textContent = t['feat.sub'];
    $$('#features .card').forEach(function (card, i) {
      card.querySelector('h3').textContent = t['feat.t.' + i];
      card.querySelector('p').textContent = t['feat.d.' + i];
    });

    $('#how .section-head h2').textContent = t['how.head'];
    $('#how .section-head p').textContent = t['how.sub'];
    $$('.steps li').forEach(function (li, i) {
      li.querySelector('h3').textContent = t['how.t.' + i];
      li.querySelector('p').textContent = t['how.d.' + i];
    });

    $('#pricing .section-head h2').textContent = t['pr.head'];
    $('#pricing .section-head p').textContent = t['pr.sub'];
    $('.price-card.featured .badge').textContent = t['pr.badge'];
    $$('.pricing .price-card').forEach(function (card, i) {
      var h3 = card.querySelector('h3'); if (h3) h3.textContent = t['pr.name.' + i];
      // Starter/Clinic render "<price> <span>DA / month</span>"; Enterprise
      // uses ".price.custom" with no inner span \u2014 guard both shapes
      var per = card.querySelector('.price span');
      if (per) per.textContent = t['pr.per'];
      var custom = card.querySelector('.price.custom');
      if (custom) custom.textContent = t['pr.custom'];
      var fEl = card.querySelector('.for'); if (fEl) fEl.textContent = t['pr.for.' + i];
      var ul = card.querySelector('ul');
      if (ul) ul.innerHTML = t['pr.li.' + i].map(function (x) { return '<li>' + x + '</li>'; }).join('');
    });
    $('.pricing-note').textContent = t['pr.note'];

    $('#faq .section-head h2').textContent = t['faq.head'];
    $$('.faq-list .faq').forEach(function (d, i) {
      d.querySelector('summary').textContent = t['faq.q.' + i];
      d.querySelector('p').textContent = t['faq.a.' + i];
    });

    $('.cta-band h2').textContent = t['cta.head'];
    $('.cta-band p').textContent = t['cta.sub'];
    $('.footer p').textContent = t['footer.copy'];
    var fl = $$('.footer-links a'); if (fl[0]) fl[0].textContent = t['footer.contact'];

    // --- interactive mock ---
    if (!m) return;
    try {
    document.querySelectorAll('.app-side .side-item').forEach(function (tab) {
      var lbl = m.tabs[tab.getAttribute('data-page')];
      var span = tab.querySelector('span');
      if (lbl && span) span.textContent = lbl;
    });
    var dashK = document.querySelectorAll('[data-panel="dashboard"] .app-card .k');
    dashK[0].textContent = m.kToday; dashK[1].textContent = m.kRev;
    $('[data-panel="dashboard"] .sched-head span').textContent = m.kSched;
    $('[data-panel="dashboard"] .sched-head .pill').textContent = m.wed;
    var dashRows = [
      ['09:00', 'var(--scheduled)', 'Amina B.', m.tr.cleaning, 'Dr. Karim'],
      ['09:45', 'var(--confirmed)', 'Yacine M.', m.tr.filling, 'Dr. Lina'],
      ['10:30', 'var(--success)', 'Soraya K.', m.tr.checkup, 'Dr. Karim'],
      ['11:15', 'var(--warning)', 'Omar T.', m.tr.root, 'Dr. Lina']
    ];
    document.querySelectorAll('[data-panel="dashboard"] .app-schedule .row').forEach(function (r, i) {
      var d = dashRows[i];
      r.innerHTML = '<i style="background:' + d[1] + '"></i><b>' + d[0] + '</b> ' + d[2] + ' \u2014 ' + d[3] + ' <em>' + d[4] + '</em>';
    });
    $('.fake-search').lastChild.textContent = m.searchPh;
    var ems = document.querySelectorAll('[data-panel="patients"] .lrow em');
    [m.lastToday, m.last3, m.lastWeek, m.newPat].forEach(function (v, i) { if (ems[i]) ems[i].textContent = v; });
    var billK = document.querySelectorAll('[data-panel="billing"] .app-card .k');
    billK[0].textContent = m.kOut; billK[1].textContent = m.kCol;
    var pillMap = [['paid-pill', m.paid], ['partial-pill', m.partial], ['unpaid-pill', m.unpaid]];
    pillMap.forEach(function (p) { var el = $('.' + p[0]); if (el) el.textContent = p[1]; });
    var lowB = document.querySelector('.stock.low b'); if (lowB) lowB.textContent = m.low;
    var srows = document.querySelectorAll('[data-panel="settings"] .srow span:first-child');
    [m.dark, m.rem, m.bak, m.langLbl].forEach(function (v, i) { if (srows[i]) srows[i].textContent = v; });
    var langPill = document.querySelector('[data-panel="settings"] .srow .pill');
    if (langPill) langPill.textContent = lang;
    } catch (_) { /* mock is decorative \u2014 never let it break translations */ }

    // calendar chrome
    try {
    $('.cal-title').textContent = m.month;
    $('.cal-head .pill').textContent = m.monthPill;
    $$('.cal-week span').forEach(function (sEl, i) { sEl.textContent = m.days[i]; });
    $('.cal-dayview .sched-head span').textContent = m.apptList;
    if (typeof currentOpenDay === 'number' && !dayView.hidden && typeof openDay === 'function') {
      openDay(currentOpenDay);
    }
    } catch (_) { }
  }

  // language picker
  var langBtn = document.getElementById('langBtn');
  var langMenu = document.getElementById('langMenu');
  langBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = langMenu.classList.toggle('open');
    langBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function () { langMenu.classList.remove('open'); });
  langMenu.querySelectorAll('button[data-lang]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      langMenu.classList.remove('open');
      applyLang(b.getAttribute('data-lang'));
    });
  });

  applyLang(LANG);
})();
