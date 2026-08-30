/* Shared Algerian phone normalizer — mirrors the desktop client's
   libphonenumber (region DZ) behavior so local formats like
   "0549468120" or "05 49 46 81 20" are accepted and normalized to E.164.
   Depends on the self-hosted bundle in libphonenumber.min.js (global `libphonenumber`). */
(function (global) {
  'use strict';

  function normalizeDZPhone(raw) {
    if (!raw) return null;
    try {
      var p = global.libphonenumber.parsePhoneNumberFromString(raw, 'DZ');
      if (p && p.country === 'DZ' && p.isValid()) {
        return p.format('E.164');
      }
    } catch (e) { /* fall through */ }
    return null;
  }

  global.normalizeDZPhone = normalizeDZPhone;
})(window);
