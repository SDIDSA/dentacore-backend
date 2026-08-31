-- ============================================================================
-- Sera PRODUCTION seed (system defaults)
-- ============================================================================
-- Idempotent seed of ALL system-level reference data required for the application
-- to function in ANY environment (production, staging, dev): roles, platform
-- plans, global treatment + inventory categories, wilayas, and payment methods.
-- This is distinct from seed.sql, which loads ONLY optional DEMO data for three
-- clinics and assumes this file has been applied first.
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


-- ----------------------------------------------------------------------------
-- 4. Algerian wilayas (58 provinces)
-- ----------------------------------------------------------------------------
-- Global reference data used by user/patient/supplier address fields. Idempotent
-- on the unique `code`; re-runs are no-ops.
INSERT INTO wilayas (id, code, name_key) VALUES
    (1, '01', 'geo.wilaya.01'),    -- Adrar
    (2, '02', 'geo.wilaya.02'),    -- Chlef
    (3, '03', 'geo.wilaya.03'),    -- Laghouat
    (4, '04', 'geo.wilaya.04'),    -- Oum El Bouaghi
    (5, '05', 'geo.wilaya.05'),    -- Batna
    (6, '06', 'geo.wilaya.06'),    -- Béjaïa
    (7, '07', 'geo.wilaya.07'),    -- Biskra
    (8, '08', 'geo.wilaya.08'),    -- Béchar
    (9, '09', 'geo.wilaya.09'),    -- Blida
    (10, '10', 'geo.wilaya.10'),   -- Bouira
    (11, '11', 'geo.wilaya.11'),   -- Tamanrasset
    (12, '12', 'geo.wilaya.12'),   -- Tébessa
    (13, '13', 'geo.wilaya.13'),   -- Tlemcen
    (14, '14', 'geo.wilaya.14'),   -- Tiaret
    (15, '15', 'geo.wilaya.15'),   -- Tizi Ouzou
    (16, '16', 'geo.wilaya.16'),   -- Algiers
    (17, '17', 'geo.wilaya.17'),   -- Djelfa
    (18, '18', 'geo.wilaya.18'),   -- Jijel
    (19, '19', 'geo.wilaya.19'),   -- Sétif
    (20, '20', 'geo.wilaya.20'),   -- Saïda
    (21, '21', 'geo.wilaya.21'),   -- Skikda
    (22, '22', 'geo.wilaya.22'),   -- Sidi Bel Abbès
    (23, '23', 'geo.wilaya.23'),   -- Annaba
    (24, '24', 'geo.wilaya.24'),   -- Guelma
    (25, '25', 'geo.wilaya.25'),   -- Constantine
    (26, '26', 'geo.wilaya.26'),   -- Médéa
    (27, '27', 'geo.wilaya.27'),   -- Mostaganem
    (28, '28', 'geo.wilaya.28'),   -- M'Sila
    (29, '29', 'geo.wilaya.29'),   -- Mascara
    (30, '30', 'geo.wilaya.30'),   -- Ouargla
    (31, '31', 'geo.wilaya.31'),   -- Oran
    (32, '32', 'geo.wilaya.32'),   -- El Bayadh
    (33, '33', 'geo.wilaya.33'),   -- Illizi
    (34, '34', 'geo.wilaya.34'),   -- Bordj Bou Arréridj
    (35, '35', 'geo.wilaya.35'),   -- Boumerdès
    (36, '36', 'geo.wilaya.36'),   -- El Tarf
    (37, '37', 'geo.wilaya.37'),   -- Tindouf
    (38, '38', 'geo.wilaya.38'),   -- Tissemsilt
    (39, '39', 'geo.wilaya.39'),   -- El Oued
    (40, '40', 'geo.wilaya.40'),   -- Khenchela
    (41, '41', 'geo.wilaya.41'),   -- Souk Ahras
    (42, '42', 'geo.wilaya.42'),   -- Tipaza
    (43, '43', 'geo.wilaya.43'),   -- Mila
    (44, '44', 'geo.wilaya.44'),   -- Aïn Defla
    (45, '45', 'geo.wilaya.45'),   -- Naâma
    (46, '46', 'geo.wilaya.46'),   -- Aïn Témouchent
    (47, '47', 'geo.wilaya.47'),   -- Ghardaïa
    (48, '48', 'geo.wilaya.48'),   -- Relizane
    (49, '49', 'geo.wilaya.49'),   -- Timimoun
    (50, '50', 'geo.wilaya.50'),   -- Bordj Badji Mokhtar
    (51, '51', 'geo.wilaya.51'),   -- Ouled Djellal
    (52, '52', 'geo.wilaya.52'),   -- Béni Abbès
    (53, '53', 'geo.wilaya.53'),   -- In Salah
    (54, '54', 'geo.wilaya.54'),   -- In Guezzam
    (55, '55', 'geo.wilaya.55'),   -- Touggourt
    (56, '56', 'geo.wilaya.56'),   -- Djanet
    (57, '57', 'geo.wilaya.57'),   -- El M'Ghair
    (58, '58', 'geo.wilaya.58')    -- El Meniaa
ON CONFLICT (code) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5. Payment methods (Algeria)
-- ----------------------------------------------------------------------------
-- Global reference data used by billing/payment entry. Idempotent on the unique
-- `method_key`.
INSERT INTO payment_methods (method_key, description, is_active) VALUES
    ('pay.method.cash', 'Cash payment in Algerian Dinar', TRUE),
    ('pay.method.cib', 'CIB (Carte Interbancaire) - Algerian debit/credit card', TRUE),
    ('pay.method.baridimob', 'BaridiMob - Mobile payment via Algérie Poste', TRUE),
    ('pay.method.edahabia', 'Edahabia - Postal card payment', TRUE),
    ('pay.method.bank_transfer', 'Bank transfer to clinic account', TRUE),
    ('pay.method.check', 'Bank check payment', TRUE),
    ('pay.method.satim', 'SATIM - Electronic payment terminal', TRUE)
ON CONFLICT (method_key) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. Global inventory categories
-- ----------------------------------------------------------------------------
-- Global defaults available to every tenant. Guarded by NOT EXISTS on the
-- NULL-tenant key (the UNIQUE(tenant_id, category_key) constraint cannot dedupe
-- NULL tenant_id rows, so ON CONFLICT would not work here).
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables', NULL, 'Consumable dental supplies', TRUE
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.consumables');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials', NULL, 'Dental materials and compounds', TRUE
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.materials');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.pharmaceuticals', NULL, 'Medications and pharmaceuticals', TRUE
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.pharmaceuticals');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.instruments', NULL, 'Dental instruments and tools', TRUE
WHERE NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.instruments');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.gloves', p.id, 'Examination and surgical gloves', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.consumables' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.consumables.gloves');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.masks', p.id, 'Surgical and protective masks', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.consumables' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.consumables.masks');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.cotton', p.id, 'Cotton products and gauze', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.consumables' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.consumables.cotton');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.composite', p.id, 'Composite resins and fillings', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.materials' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.materials.composite');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.impression', p.id, 'Impression materials', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.materials' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.materials.impression');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.cement', p.id, 'Dental cements and bonding agents', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.materials' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.materials.cement');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.pharmaceuticals.anesthetics', p.id, 'Local anesthetics', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.pharmaceuticals' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.pharmaceuticals.anesthetics');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.instruments.hand', p.id, 'Hand instruments and tools', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.instruments' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.instruments.hand');

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.instruments.rotary', p.id, 'Rotary instruments and burs', TRUE
FROM inventory_categories p
WHERE p.category_key = 'inv.instruments' AND p.tenant_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM inventory_categories WHERE tenant_id IS NULL AND category_key = 'inv.instruments.rotary');
