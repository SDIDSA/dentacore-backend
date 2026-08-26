/* Shared pre-paint + controls for the Sera public pages (booking portal +
   signup). Load in <head> BEFORE the page script: the pre-paint section
   resolves lang + theme synchronously so there is no RTL/theme flash.
   Switchers persist to dc-lang / dc-theme — the SAME keys the marketing
   site (index.html) uses, so preferences carry across the whole site. */
(function () {
  'use strict';

  var de = document.documentElement;
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  // ---- pre-paint: resolve language and theme before first paint ------------
  var qs = new URLSearchParams(location.search);
  var ql = qs.get('lang');
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
  var qt = qs.get('theme');            // one-shot override (?theme=dark|light), not persisted
  if (qt === 'dark' || qt === 'light') th = qt;
  de.setAttribute('lang', lang);
  de.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  de.setAttribute('data-theme', th);

  function setLang(l, onLangChange) {
    if (['en', 'fr', 'ar'].indexOf(l) < 0 || l === lang) return;
    lang = l;
    try { localStorage.setItem('dc-lang', l); } catch (e) {}
    de.setAttribute('lang', l);
    de.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
    if (onLangChange) onLangChange();
  }

  // wire the standard header controls (.lang-group buttons + #themeBtn);
  // onLangChange is called after the language changes so the page re-renders
  function wireControls(onLangChange) {
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.addEventListener('click', function () { setLang(this.getAttribute('data-l'), onLangChange); });
    });
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', function () {
        var next = de.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        de.setAttribute('data-theme', next);
        try { localStorage.setItem('dc-theme', next); } catch (e) {}
      });
    }
  }

  window.SITE = {
    get lang() { return lang; },
    setLang: setLang,
    wireControls: wireControls,
    stored: stored
  };
})();
