// Email canonicalisation for express-validator's normalizeEmail().
// Its defaults rewrite provider-specific addresses (Gmail dots removed, "+tag"
// sub-addresses dropped, googlemail.com -> gmail.com), so a stored
// "first.last@gmail.com" no longer matches the "firstlast@gmail.com" a login
// lookup searches for. Sera stores addresses as typed, so only lowercase.
// Not frozen: validator.js merges its defaults INTO the passed options object.
const EMAIL_NORMALIZE = {
  all_lowercase: true,
  gmail_lowercase: true,
  gmail_remove_dots: false,
  gmail_remove_subaddress: false,
  gmail_convert_googlemaildotcom: false,
  outlookdotcom_remove_subaddress: false,
  yahoo_remove_subaddress: false,
  icloud_remove_subaddress: false,
};

module.exports = { EMAIL_NORMALIZE };
