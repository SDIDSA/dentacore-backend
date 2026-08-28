/* resolve language before first paint to avoid wrong-direction flash */
(function () {
  var l = 'en';
  try {
    l = localStorage.getItem('dc-lang') || l;
  } catch (_) {}
  if (!l || l === 'en') {
    var nav = (navigator.language || '').toLowerCase();
    l = nav.indexOf('fr') === 0 ? 'fr' : (nav.indexOf('ar') === 0 ? 'ar' : 'en');
  }
  window.APP_NAME = 'Sera'; // app name SSOT for this site (mirrors pom.xml <app.name>)
  document.documentElement.setAttribute('lang', l);
  /* data-lang is what the i18n engine boots from (applyLang's initial LANG) —
     without it a returning visitor's saved language was ignored */
  document.documentElement.setAttribute('data-lang', l);
  document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
})();
