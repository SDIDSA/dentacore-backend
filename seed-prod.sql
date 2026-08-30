-- ============================================================================
-- Sera PRODUCTION seed (system defaults)
-- ============================================================================
-- Idempotent seed of system-level reference data required for the application
-- to function in ANY environment (production, staging, dev). This is distinct
-- from seed.sql, which loads optional DEMO data for three clinics.
--
-- Run this on every provisioned database. It is safe to re-run (all statements
-- are guarded so they never error on an already-seeded database) and is applied
-- as its own step AFTER db.sql, so it always runs even if db.sql aborts on a
-- re-apply (db.sql is applied with ON_ERROR_STOP=1 and will stop at the first
-- already-existing object).
--
-- Usage:
--   psql -h <host> -p <port> -U <user> -d <db> -f seed-prod.sql
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Roles
-- ----------------------------------------------------------------------------
-- Required for signup and user creation. Without these, auth.role.* lookups
-- fail and self-signup cannot assign auth.role.admin.
INSERT INTO roles (role_key, description) VALUES
    ('auth.role.admin', 'System Administrator with full access'),
    ('auth.role.dentist', 'Licensed dentist with clinical access'),
    ('auth.role.receptionist', 'Front desk staff for appointments and billing'),
    ('auth.role.platform_admin', 'Platform owner - manages all tenants (Sera operator)')
ON CONFLICT (role_key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. Platform subscription plans
-- ----------------------------------------------------------------------------
INSERT INTO platform_plans (name, label, monthly_price_dzd, annual_price_dzd, max_users, max_patients, features, sort_order) VALUES
    ('free',       'Free',       0,      0,      2,    50,   '["basic appointments","patient records"]', 0),
    ('starter',    'Starter',    15000,  150000, 5,    500,  '["appointments","patients","prescriptions","basic reports"]', 1),
    ('clinic',     'Clinic',     35000,  350000, 15,   5000,  '["all starter","billing","inventory","x-rays","treatment plans","advanced reports"]', 2),
    ('enterprise', 'Enterprise', 75000,  750000, 999,  99999,'["all clinic","audit logs","multi-branch","priority support"]', 3)
ON CONFLICT (name) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. Global treatment categories (booking portal service list)
-- ----------------------------------------------------------------------------
-- Back the public booking portal's service list for EVERY clinic, including
-- ones created via self-signup that have no custom categories of their own.
-- Guarded by NOT EXISTS on the NULL-tenant key (the UNIQUE(tenant_id,
-- category_key) constraint cannot dedupe NULL tenant_id rows, so ON CONFLICT
-- would not work here).
INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, v.key, NULL, v.description, TRUE FROM (VALUES
  ('cat.preventive', 'Preventive dental care'),
  ('cat.restorative', 'Restorative procedures'),
  ('cat.surgery', 'Oral and maxillofacial surgery'),
  ('cat.orthodontics', 'Orthodontic treatments'),
  ('cat.endodontics', 'Root canal treatments'),
  ('cat.periodontics', 'Gum disease treatments'),
  ('cat.prosthodontics', 'Dental prosthetics'),
  ('cat.cosmetic', 'Cosmetic dentistry')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = v.key
);

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.cleaning', p.id, 'Professional teeth cleaning', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.preventive' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.preventive.cleaning');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.fluoride', p.id, 'Fluoride treatment', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.preventive' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.preventive.fluoride');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.sealants', p.id, 'Dental sealants', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.preventive' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.preventive.sealants');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.filling', p.id, 'Dental fillings (composite/amalgam)', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.restorative' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.restorative.filling');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.crown', p.id, 'Dental crowns', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.restorative' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.restorative.crown');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.bridge', p.id, 'Dental bridges', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.restorative' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.restorative.bridge');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.extraction', p.id, 'Tooth extraction (simple/surgical)', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.surgery' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.surgery.extraction');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.implant', p.id, 'Dental implant placement', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.surgery' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.surgery.implant');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.wisdom_tooth', p.id, 'Wisdom tooth removal', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.surgery' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.surgery.wisdom_tooth');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.endodontics.root_canal', p.id, 'Root canal therapy', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.endodontics' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.endodontics.root_canal');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.orthodontics.braces', p.id, 'Traditional metal braces', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.orthodontics' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.orthodontics.braces');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.orthodontics.clear_aligners', p.id, 'Clear aligners (Invisalign-type)', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.orthodontics' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.orthodontics.clear_aligners');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.cosmetic.whitening', p.id, 'Teeth whitening', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.cosmetic' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.cosmetic.whitening');

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.cosmetic.veneers', p.id, 'Dental veneers', TRUE
FROM treatment_categories p
WHERE p.category_key = 'cat.cosmetic' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM treatment_categories WHERE tenant_id IS NULL AND category_key = 'cat.cosmetic.veneers');
