// Derive a single display role from a user's role_keys array.
// All roles are equal; this is ONLY for UI that must show one badge
// (there is no primary/secondary distinction in authorization or logic).
// Admin is preferred when present so admin surfaces stay visible; otherwise
// the first role is used.
const ADMIN_ROLE_KEY = 'auth.role.admin';

function primaryRoleKey(keys) {
  if (!keys || keys.length === 0) return null;
  if (keys.includes(ADMIN_ROLE_KEY)) return ADMIN_ROLE_KEY;
  return keys[0];
}

module.exports = { primaryRoleKey, ADMIN_ROLE_KEY };
