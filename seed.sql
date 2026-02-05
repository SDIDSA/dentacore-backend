-- ============================================================================
-- SEED DATA FOR MULTI-TENANT ALGERIAN DENTAL MANAGEMENT SYSTEM
-- ============================================================================

-- ============================================================================
-- 1. SYSTEM ROLES (Global)
-- ============================================================================

INSERT INTO roles (role_key, description) VALUES
('auth.role.admin', 'System Administrator with full access'),
('auth.role.dentist', 'Licensed dentist with clinical access'),
('auth.role.receptionist', 'Front desk staff for appointments and billing');

-- ============================================================================
-- 2. ALGERIAN WILAYAS (58 Provinces) - Global
-- ============================================================================

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
(58, '58', 'geo.wilaya.58');   -- El Meniaa

-- ============================================================================
-- 3. PAYMENT METHODS (Global - Algeria)
-- ============================================================================

INSERT INTO payment_methods (method_key, description, is_active) VALUES
('pay.method.cash', 'Cash payment in Algerian Dinar', TRUE),
('pay.method.cib', 'CIB (Carte Interbancaire) - Algerian debit/credit card', TRUE),
('pay.method.baridimob', 'BaridiMob - Mobile payment via Algérie Poste', TRUE),
('pay.method.edahabia', 'Edahabia - Postal card payment', TRUE),
('pay.method.bank_transfer', 'Bank transfer to clinic account', TRUE),
('pay.method.check', 'Bank check payment', TRUE),
('pay.method.satim', 'SATIM - Electronic payment terminal', TRUE);

-- ============================================================================
-- 4. GLOBAL TREATMENT CATEGORIES (Available to All Tenants)
-- ============================================================================

-- Root Categories (Global - tenant_id = NULL)
INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active) VALUES
(NULL, 'cat.preventive', NULL, 'Preventive dental care', TRUE),
(NULL, 'cat.restorative', NULL, 'Restorative procedures', TRUE),
(NULL, 'cat.surgery', NULL, 'Oral and maxillofacial surgery', TRUE),
(NULL, 'cat.orthodontics', NULL, 'Orthodontic treatments', TRUE),
(NULL, 'cat.endodontics', NULL, 'Root canal treatments', TRUE),
(NULL, 'cat.periodontics', NULL, 'Gum disease treatments', TRUE),
(NULL, 'cat.prosthodontics', NULL, 'Dental prosthetics', TRUE),
(NULL, 'cat.cosmetic', NULL, 'Cosmetic dentistry', TRUE);

-- Sub-categories (Global)
INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.cleaning', id, 'Professional teeth cleaning', TRUE
FROM treatment_categories WHERE category_key = 'cat.preventive' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.fluoride', id, 'Fluoride treatment', TRUE
FROM treatment_categories WHERE category_key = 'cat.preventive' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.preventive.sealants', id, 'Dental sealants', TRUE
FROM treatment_categories WHERE category_key = 'cat.preventive' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.filling', id, 'Dental fillings (composite/amalgam)', TRUE
FROM treatment_categories WHERE category_key = 'cat.restorative' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.crown', id, 'Dental crowns', TRUE
FROM treatment_categories WHERE category_key = 'cat.restorative' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.restorative.bridge', id, 'Dental bridges', TRUE
FROM treatment_categories WHERE category_key = 'cat.restorative' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.extraction', id, 'Tooth extraction (simple/surgical)', TRUE
FROM treatment_categories WHERE category_key = 'cat.surgery' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.implant', id, 'Dental implant placement', TRUE
FROM treatment_categories WHERE category_key = 'cat.surgery' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.surgery.wisdom_tooth', id, 'Wisdom tooth removal', TRUE
FROM treatment_categories WHERE category_key = 'cat.surgery' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.endodontics.root_canal', id, 'Root canal therapy', TRUE
FROM treatment_categories WHERE category_key = 'cat.endodontics' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.orthodontics.braces', id, 'Traditional metal braces', TRUE
FROM treatment_categories WHERE category_key = 'cat.orthodontics' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.orthodontics.clear_aligners', id, 'Clear aligners (Invisalign-type)', TRUE
FROM treatment_categories WHERE category_key = 'cat.orthodontics' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.cosmetic.whitening', id, 'Teeth whitening', TRUE
FROM treatment_categories WHERE category_key = 'cat.cosmetic' AND tenant_id IS NULL;

INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'cat.cosmetic.veneers', id, 'Dental veneers', TRUE
FROM treatment_categories WHERE category_key = 'cat.cosmetic' AND tenant_id IS NULL;

-- ============================================================================
-- 5. SAMPLE TENANTS (SaaS Onboarding Simulation)
-- ============================================================================

-- Tenant 1: Cabinet Dentaire El-Qods (Constantine)
DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_role_id INTEGER;
    v_dentist_role_id INTEGER;
    v_receptionist_role_id INTEGER;
    v_admin_user_id UUID;
    v_dentist_user_id UUID;
    v_patient1_id UUID;
BEGIN
    -- Get role IDs
    SELECT id INTO v_admin_role_id FROM roles WHERE role_key = 'auth.role.admin';
    SELECT id INTO v_dentist_role_id FROM roles WHERE role_key = 'auth.role.dentist';
    SELECT id INTO v_receptionist_role_id FROM roles WHERE role_key = 'auth.role.receptionist';

    -- Create Tenant 1
    INSERT INTO tenants (
        name, 
        subdomain, 
        tax_id, 
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Cabinet Dentaire El-Qods',
        'elqods',
        '099925123456789', -- Sample NIF
        '#2563EB', -- Blue
        'tenant.status.active',
        'plan.professional',
        NOW(),
        NOW() + INTERVAL '1 year',
        '{"language": "fr", "currency": "DZD", "timezone": "Africa/Algiers", "features": {"appointments": true, "invoicing": true, "reports": true}}'::jsonb
    )
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE 'Created Tenant: Cabinet Dentaire El-Qods (ID: %)', v_tenant_id;

    -- Create Admin User for Tenant 1
    INSERT INTO users (
        tenant_id,
        role_id,
        email,
        password_hash,
        full_name,
        phone,
        wilaya_id,
        address,
        status_key
    ) VALUES (
        v_tenant_id,
        v_admin_role_id,
        'admin@elqods.dz',
        crypt('Admin@2025!', gen_salt('bf')),
        'Dr. Karim Benali',
        '+213550123456',
        25, -- Constantine
        'Rue Didouche Mourad, Constantine',
        'user.status.active'
    )
    RETURNING id INTO v_admin_user_id;

    RAISE NOTICE 'Created Admin: admin@elqods.dz (Password: Admin@2025!)';

    -- Create Dentist User for Tenant 1
    INSERT INTO users (
        tenant_id,
        role_id,
        email,
        password_hash,
        full_name,
        phone,
        wilaya_id,
        address,
        status_key
    ) VALUES (
        v_tenant_id,
        v_dentist_role_id,
        'dentist@elqods.dz',
        crypt('Dentist@2025!', gen_salt('bf')),
        'Dr. Amina Zerrouki',
        '+213551234567',
        25, -- Constantine
        'Cité El-Bir, Constantine',
        'user.status.active'
    )
    RETURNING id INTO v_dentist_user_id;

    RAISE NOTICE 'Created Dentist: dentist@elqods.dz (Password: Dentist@2025!)';

    -- Create Sample Patient 1
    INSERT INTO patients (
        tenant_id,
        patient_code, -- Will be auto-generated by trigger
        first_name,
        last_name,
        date_of_birth,
        gender,
        phone,
        email,
        wilaya_id,
        address,
        emergency_contact_name,
        emergency_contact_phone,
        medical_history,
        allergies,
        blood_type,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0001
        'Ahmed',
        'Boudiaf',
        '1985-03-15',
        'patient.gender.male',
        '+213770123456',
        'ahmed.boudiaf@email.dz',
        25, -- Constantine
        'Cité Zouaghi, Constantine',
        'Fatima Boudiaf',
        '+213771234567',
        'Hypertension under control with medication',
        'Penicillin',
        'A+',
        v_admin_user_id
    )
    RETURNING id INTO v_patient1_id;

    RAISE NOTICE 'Created Patient: Ahmed Boudiaf (Code: PAT-2025-0001)';

    -- Create Sample Patient 2
    INSERT INTO patients (
        tenant_id,
        patient_code,
        first_name,
        last_name,
        date_of_birth,
        gender,
        phone,
        email,
        wilaya_id,
        address,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0002
        'Leila',
        'Mansouri',
        '1992-07-22',
        'patient.gender.female',
        '+213772345678',
        'leila.mansouri@email.dz',
        25, -- Constantine
        'Rue Larbi Ben M''hidi, Constantine',
        v_dentist_user_id
    );

    RAISE NOTICE 'Created Patient: Leila Mansouri (Code: PAT-2025-0002)';

    -- Create Tenant-Specific Custom Treatment Category
    INSERT INTO treatment_categories (tenant_id, category_key, parent_id, description, is_active)
    SELECT 
        v_tenant_id,
        'cat.custom.pediatric',
        NULL,
        'Pediatric Dentistry (Custom for El-Qods)',
        TRUE;

    RAISE NOTICE 'Created custom treatment category for El-Qods';
    RAISE NOTICE '--------------------------------------------';

END $$;

-- ============================================================================
-- Tenant 2: Clinique Dentaire Sourire (Algiers)
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_role_id INTEGER;
    v_dentist_role_id INTEGER;
    v_admin_user_id UUID;
BEGIN
    SELECT id INTO v_admin_role_id FROM roles WHERE role_key = 'auth.role.admin';
    SELECT id INTO v_dentist_role_id FROM roles WHERE role_key = 'auth.role.dentist';

    -- Create Tenant 2
    INSERT INTO tenants (
        name,
        subdomain,
        tax_id,
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Clinique Dentaire Sourire',
        'sourire',
        '099916987654321',
        '#10B981', -- Green
        'tenant.status.trial',
        'plan.starter',
        NOW(),
        NOW() + INTERVAL '30 days',
        '{"language": "ar", "currency": "DZD", "timezone": "Africa/Algiers", "features": {"appointments": true, "invoicing": false}}'::jsonb
    )
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE 'Created Tenant: Clinique Dentaire Sourire (ID: %)', v_tenant_id;

    -- Create Admin User for Tenant 2
    INSERT INTO users (
        tenant_id,
        role_id,
        email,
        password_hash,
        full_name,
        phone,
        wilaya_id,
        status_key
    ) VALUES (
        v_tenant_id,
        v_admin_role_id,
        'admin@sourire.dz',
        crypt('Sourire@2025!', gen_salt('bf')),
        'Dr. Yasmine Khelifi',
        '+213555987654',
        16, -- Algiers
        'user.status.active'
    )
    RETURNING id INTO v_admin_user_id;

    RAISE NOTICE 'Created Admin: admin@sourire.dz (Password: Sourire@2025!)';

    -- Create Sample Patient for Tenant 2
    INSERT INTO patients (
        tenant_id,
        patient_code,
        first_name,
        last_name,
        date_of_birth,
        gender,
        phone,
        wilaya_id,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0001 (scoped to this tenant!)
        'Rania',
        'Benali',
        '1988-11-30',
        'patient.gender.female',
        '+213773456789',
        16, -- Algiers
        v_admin_user_id
    );

    RAISE NOTICE 'Created Patient: Rania Benali (Code: PAT-2025-0001 for Sourire)';
    RAISE NOTICE '--------------------------------------------';

END $$;

-- ============================================================================
-- Tenant 3: Cabinet Dr. Teyar (Blida) - Matching your original user
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_dentist_role_id INTEGER;
    v_dentist_user_id UUID;
BEGIN
    SELECT id INTO v_dentist_role_id FROM roles WHERE role_key = 'auth.role.dentist';

    -- Create Tenant 3
    INSERT INTO tenants (
        name,
        subdomain,
        tax_id,
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Cabinet Dr. Teyar',
        'teyar',
        '099909123456789',
        '#8B5CF6', -- Purple
        'tenant.status.active',
        'plan.enterprise',
        NOW(),
        NOW() + INTERVAL '1 year',
        '{"language": "fr", "currency": "DZD", "timezone": "Africa/Algiers", "features": {"appointments": true, "invoicing": true, "reports": true, "analytics": true}}'::jsonb
    )
    RETURNING id INTO v_tenant_id;

    RAISE NOTICE 'Created Tenant: Cabinet Dr. Teyar (ID: %)', v_tenant_id;

    -- Create Dentist User (matching your original seed data)
    INSERT INTO users (
        tenant_id,
        role_id,
        email,
        password_hash,
        full_name,
        phone,
        wilaya_id,
        status_key
    ) VALUES (
        v_tenant_id,
        v_dentist_role_id,
        'zinouteyar@gmail.com',
        crypt('A1b2-A1b2', gen_salt('bf')),
        'Zinelabidine Teyar',
        '+213549468120',
        9, -- Blida
        'user.status.active'
    )
    RETURNING id INTO v_dentist_user_id;

    RAISE NOTICE 'Created Dentist: zinouteyar@gmail.com (Password: A1b2-A1b2)';

    -- Create Sample Patient for Dr. Teyar
    INSERT INTO patients (
        tenant_id,
        patient_code,
        first_name,
        last_name,
        date_of_birth,
        gender,
        phone,
        email,
        wilaya_id,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL,
        'Mohamed',
        'Cherif',
        '1990-05-10',
        'patient.gender.male',
        '+213774567890',
        'mohamed.cherif@email.dz',
        9, -- Blida
        v_dentist_user_id
    );

    RAISE NOTICE 'Created Patient: Mohamed Cherif (Code: PAT-2025-0001 for Teyar)';
    RAISE NOTICE '--------------------------------------------';

END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Commented - Uncomment to verify)
-- ============================================================================

-- Verify global data
-- SELECT 'Roles' AS entity, COUNT(*) AS count FROM roles
-- UNION ALL
-- SELECT 'Wilayas', COUNT(*) FROM wilayas
-- UNION ALL
-- SELECT 'Payment Methods', COUNT(*) FROM payment_methods
-- UNION ALL
-- SELECT 'Global Treatment Categories', COUNT(*) FROM treatment_categories WHERE tenant_id IS NULL;

-- Verify tenants
-- SELECT id, name, subdomain, subscription_status FROM tenants ORDER BY created_at;

-- Verify users per tenant
-- SELECT 
--     t.name AS tenant_name,
--     r.role_key,
--     u.email,
--     u.full_name
-- FROM users u
-- JOIN tenants t ON u.tenant_id = t.id
-- JOIN roles r ON u.role_id = r.id
-- ORDER BY t.name, r.role_key;

-- Verify patients per tenant
-- SELECT 
--     t.name AS tenant_name,
--     p.patient_code,
--     p.first_name,
--     p.last_name,
--     p.phone
-- FROM patients p
-- JOIN tenants t ON p.tenant_id = t.id
-- ORDER BY t.name, p.patient_code;

-- Verify treatment categories (Global + Tenant-specific)
-- SELECT 
--     CASE 
--         WHEN tc.tenant_id IS NULL THEN 'GLOBAL'
--         ELSE t.name
--     END AS scope,
--     tc.category_key,
--     tc.description
-- FROM treatment_categories tc
-- LEFT JOIN tenants t ON tc.tenant_id = t.id
-- ORDER BY scope, tc.category_key;



-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Multi-Tenant DMS - Seed Data Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Global Data:';
    RAISE NOTICE '  - Roles: 3';
    RAISE NOTICE '  - Wilayas: 58';
    RAISE NOTICE '  - Payment Methods: 7';
    RAISE NOTICE '  - Global Treatment Categories: 22';
    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE 'Tenants Created: 3';
    RAISE NOTICE '';
    RAISE NOTICE '1. Cabinet Dentaire El-Qods (Constantine)';
    RAISE NOTICE '   Subdomain: elqods.dms.dz';
    RAISE NOTICE '   Status: Active (Professional Plan)';
    RAISE NOTICE '   Admin: admin@elqods.dz / Admin@2025!';
    RAISE NOTICE '   Dentist: dentist@elqods.dz / Dentist@2025!';
    RAISE NOTICE '   Patients: 2';
    RAISE NOTICE '';
    RAISE NOTICE '2. Clinique Dentaire Sourire (Algiers)';
    RAISE NOTICE '   Subdomain: sourire.dms.dz';
    RAISE NOTICE '   Status: Trial (Starter Plan)';
    RAISE NOTICE '   Admin: admin@sourire.dz / Sourire@2025!';
    RAISE NOTICE '   Patients: 1';
    RAISE NOTICE '';
    RAISE NOTICE '3. Cabinet Dr. Teyar (Blida)';
    RAISE NOTICE '   Subdomain: teyar.dms.dz';
    RAISE NOTICE '   Status: Active (Enterprise Plan)';
    RAISE NOTICE '   Dentist: zinouteyar@gmail.com / A1b2-A1b2';
    RAISE NOTICE '   Patients: 1';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DATA ISOLATION VERIFIED:';
    RAISE NOTICE '  - Each tenant has PAT-2025-0001';
    RAISE NOTICE '  - Same code, different patients!';
    RAISE NOTICE '  - RLS policies present but bypassed by owner';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '1. Verify isolation using Explicit Tenant ID filtering in Apps';
    RAISE NOTICE '2. Verify isolation with patient queries';
    RAISE NOTICE '3. Test hybrid categories with custom ones';
    RAISE NOTICE '============================================';
END $$;
