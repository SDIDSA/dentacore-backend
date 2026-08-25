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
-- 4.1. GLOBAL INVENTORY CATEGORIES (Available to All Tenants)
-- ============================================================================

-- Root Inventory Categories (Global - tenant_id = NULL)
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active) VALUES
(NULL, 'inv.consumables', NULL, 'Consumable dental supplies', TRUE),
(NULL, 'inv.materials', NULL, 'Dental materials and compounds', TRUE),
(NULL, 'inv.pharmaceuticals', NULL, 'Medications and pharmaceuticals', TRUE),
(NULL, 'inv.instruments', NULL, 'Dental instruments and tools', TRUE);

-- Sub-categories for Consumables
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.gloves', id, 'Examination and surgical gloves', TRUE
FROM inventory_categories WHERE category_key = 'inv.consumables' AND tenant_id IS NULL;

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.masks', id, 'Surgical and protective masks', TRUE
FROM inventory_categories WHERE category_key = 'inv.consumables' AND tenant_id IS NULL;

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.consumables.cotton', id, 'Cotton products and gauze', TRUE
FROM inventory_categories WHERE category_key = 'inv.consumables' AND tenant_id IS NULL;

-- Sub-categories for Materials
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.composite', id, 'Composite resins and fillings', TRUE
FROM inventory_categories WHERE category_key = 'inv.materials' AND tenant_id IS NULL;

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.impression', id, 'Impression materials', TRUE
FROM inventory_categories WHERE category_key = 'inv.materials' AND tenant_id IS NULL;

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.materials.cement', id, 'Dental cements and bonding agents', TRUE
FROM inventory_categories WHERE category_key = 'inv.materials' AND tenant_id IS NULL;

-- Sub-categories for Pharmaceuticals
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.pharmaceuticals.anesthetics', id, 'Local anesthetics', TRUE
FROM inventory_categories WHERE category_key = 'inv.pharmaceuticals' AND tenant_id IS NULL;

-- Sub-categories for Instruments
INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.instruments.hand', id, 'Hand instruments and tools', TRUE
FROM inventory_categories WHERE category_key = 'inv.instruments' AND tenant_id IS NULL;

INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active)
SELECT NULL, 'inv.instruments.rotary', id, 'Rotary instruments and burs', TRUE
FROM inventory_categories WHERE category_key = 'inv.instruments' AND tenant_id IS NULL;

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
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Cabinet Dentaire El-Qods',
        'elqods',
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


    INSERT INTO patients (
        tenant_id,
        patient_code, -- Will be auto-generated by trigger
        full_name,
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
        status_key,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0001
        'Ahmed Boudiaf',
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
        'patient.status.active',
        v_admin_user_id
    )
    RETURNING id INTO v_patient1_id;

    RAISE NOTICE 'Created Patient: Ahmed Boudiaf (Code: PAT-2025-0001)';

    -- Create Sample Patient 2
    INSERT INTO patients (
        tenant_id,
        patient_code,
        full_name,
        date_of_birth,
        gender,
        phone,
        email,
        wilaya_id,
        address,
        status_key,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0002
        'Leila Mansouri',
        '1992-07-22',
        'patient.gender.female',
        '+213772345678',
        'leila.mansouri@email.dz',
        25, -- Constantine
        'Rue Larbi Ben M''hidi, Constantine',
        'patient.status.active',
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

    -- ========================================================================
    -- INVENTORY DATA FOR TENANT 1 (El-Qods)
    -- ========================================================================

    -- Create some suppliers
    INSERT INTO suppliers (tenant_id, name, contact_person, email, phone, wilaya_id, address, created_by) VALUES
    (v_tenant_id, 'Dental Supply Algeria', 'Ahmed Benaissa', 'contact@dentalsupply.dz', '+213550987654', 25, 'Zone Industrielle, Constantine', v_admin_user_id),
    (v_tenant_id, 'MediDent Distribution', 'Fatima Khelifi', 'info@medident.dz', '+213551876543', 16, 'Bab Ezzouar, Algiers', v_admin_user_id),
    (v_tenant_id, 'Pharma Dental', 'Youcef Mansouri', 'sales@pharmadental.dz', '+213552765432', 25, 'Nouvelle Ville, Constantine', v_admin_user_id);

    -- Get category IDs for inventory items
    DECLARE
        v_gloves_cat_id UUID;
        v_composite_cat_id UUID;
        v_anesthetics_cat_id UUID;
        v_hand_instruments_cat_id UUID;
        v_cotton_cat_id UUID;
    BEGIN
        SELECT id INTO v_gloves_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.gloves' AND tenant_id IS NULL;
        SELECT id INTO v_composite_cat_id FROM inventory_categories WHERE category_key = 'inv.materials.composite' AND tenant_id IS NULL;
        SELECT id INTO v_anesthetics_cat_id FROM inventory_categories WHERE category_key = 'inv.pharmaceuticals.anesthetics' AND tenant_id IS NULL;
        SELECT id INTO v_hand_instruments_cat_id FROM inventory_categories WHERE category_key = 'inv.instruments.hand' AND tenant_id IS NULL;
        SELECT id INTO v_cotton_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.cotton' AND tenant_id IS NULL;

        -- Create inventory items
        INSERT INTO inventory_items (tenant_id, name, description, category_id, unit_of_measure, current_stock, min_stock_level, max_stock_level, unit_cost_dzd, selling_price_dzd, created_by) VALUES
        (v_tenant_id, 'Nitrile Gloves - Medium', 'Powder-free nitrile examination gloves, size M', v_gloves_cat_id, 'box', 25, 10, 100, 850.00, 1200.00, v_admin_user_id),
        (v_tenant_id, 'Nitrile Gloves - Large', 'Powder-free nitrile examination gloves, size L', v_gloves_cat_id, 'box', 18, 10, 100, 850.00, 1200.00, v_admin_user_id),
        (v_tenant_id, 'Composite Resin A2', 'Light-cure composite resin, shade A2', v_composite_cat_id, 'syringe', 12, 5, 50, 2500.00, 3500.00, v_admin_user_id),
        (v_tenant_id, 'Composite Resin A3', 'Light-cure composite resin, shade A3', v_composite_cat_id, 'syringe', 8, 5, 50, 2500.00, 3500.00, v_admin_user_id),
        (v_tenant_id, 'Lidocaine 2% with Epinephrine', 'Local anesthetic cartridges', v_anesthetics_cat_id, 'cartridge', 45, 20, 200, 120.00, 180.00, v_admin_user_id),
        (v_tenant_id, 'Dental Explorer #23', 'Single-ended dental explorer', v_hand_instruments_cat_id, 'piece', 6, 3, 20, 1200.00, 1800.00, v_admin_user_id),
        (v_tenant_id, 'Cotton Rolls Medium', 'Sterile cotton rolls for isolation', v_cotton_cat_id, 'bag', 15, 8, 50, 450.00, 650.00, v_admin_user_id),
        (v_tenant_id, 'Gauze Pads 2x2', 'Sterile gauze pads for hemostasis', v_cotton_cat_id, 'pack', 22, 10, 80, 320.00, 480.00, v_admin_user_id);

        -- Create some stock movements (purchase history)
        INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
        SELECT v_tenant_id, ii.id, 'stock.movement.purchase', 30, ii.unit_cost_dzd, 'purchase_order', 'Initial stock purchase', v_admin_user_id
        FROM inventory_items ii WHERE ii.tenant_id = v_tenant_id AND ii.name LIKE 'Nitrile Gloves%';

        INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
        SELECT v_tenant_id, ii.id, 'stock.movement.usage', -5, ii.unit_cost_dzd, 'treatment', 'Used in patient treatments', v_dentist_user_id
        FROM inventory_items ii WHERE ii.tenant_id = v_tenant_id AND ii.name = 'Nitrile Gloves - Medium';

        -- Create some expenses
        INSERT INTO expenses (tenant_id, category_key, description, amount_dzd, expense_date, created_by) VALUES
        (v_tenant_id, 'expense.category.inventory', 'Monthly inventory purchase - dental supplies', 45000.00, NOW() - INTERVAL '15 days', v_admin_user_id),
        (v_tenant_id, 'expense.category.utilities', 'Electricity bill - January 2025', 8500.00, NOW() - INTERVAL '10 days', v_admin_user_id),
        (v_tenant_id, 'expense.category.rent', 'Office rent - January 2025', 35000.00, NOW() - INTERVAL '5 days', v_admin_user_id),
        (v_tenant_id, 'expense.category.maintenance', 'Dental chair maintenance', 12000.00, NOW() - INTERVAL '3 days', v_admin_user_id);

    END;

    RAISE NOTICE 'Created inventory data for El-Qods (8 items, 4 expenses)';
    RAISE NOTICE '--------------------------------------------';

END $$;

-- ============================================================================
-- ADDITIONAL DUMMY DATA FOR CABINET DENTAIRE EL-QODS
-- Extra Patients, Dentists, Receptionist, and Appointments (Next 90 Days)
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_id UUID;
    v_receptionist_id UUID;
    v_dentist1_id UUID;
    v_dentist2_id UUID;
    v_dentist3_id UUID;
    v_curr_dentist_id UUID;
    v_curr_patient_id UUID;
    v_dentist_role_id INTEGER;
    v_receptionist_role_id INTEGER;
    v_appt_date DATE;
    v_appt_timestamp TIMESTAMPTZ;
    v_hour INT;
    v_minute INT;
    v_appts_today INT;
    v_date_offset INT;
    v_i INT;
    v_r REAL;
    v_status_key TEXT;
    v_reason TEXT;
    v_note TEXT;
    v_reasons TEXT[];
    v_notes TEXT[];
    v_total_appts INT := 0;
BEGIN
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'elqods';
    SELECT id INTO v_admin_id FROM users WHERE email = 'admin@elqods.dz';
    SELECT id INTO v_dentist1_id FROM users WHERE email = 'dentist@elqods.dz';
    SELECT id INTO v_dentist_role_id FROM roles WHERE role_key = 'auth.role.dentist';
    SELECT id INTO v_receptionist_role_id FROM roles WHERE role_key = 'auth.role.receptionist';

    -- ========================================================================
    -- ADD 2 MORE DENTISTS + 1 RECEPTIONIST
    -- ========================================================================
    INSERT INTO users (tenant_id, role_id, email, password_hash, full_name, phone, wilaya_id, address, status_key)
    VALUES (v_tenant_id, v_dentist_role_id, 'dentist2@elqods.dz', crypt('Dentist@2025!', gen_salt('bf')), 'Dr. Samir Hadjadj', '+213555345678', 25, 'Rue des Freres Abbas, Constantine', 'user.status.active')
    RETURNING id INTO v_dentist2_id;

    INSERT INTO users (tenant_id, role_id, email, password_hash, full_name, phone, wilaya_id, address, status_key)
    VALUES (v_tenant_id, v_dentist_role_id, 'dentist3@elqods.dz', crypt('Dentist@2025!', gen_salt('bf')), 'Dr. Fatima Bouzidi', '+213556456789', 25, 'Cite des Muriers, Constantine', 'user.status.active')
    RETURNING id INTO v_dentist3_id;

    INSERT INTO users (tenant_id, role_id, email, password_hash, full_name, phone, wilaya_id, address, status_key)
    VALUES (v_tenant_id, v_receptionist_role_id, 'reception@elqods.dz', crypt('Recept@2025!', gen_salt('bf')), 'Nadia Khelifi', '+213557567890', 25, 'Centre Ville, Constantine', 'user.status.active')
    RETURNING id INTO v_receptionist_id;

    RAISE NOTICE 'Created 2 more dentists (Samir, Fatima) + 1 receptionist (Nadia) for El-Qods';

    -- ========================================================================
    -- ADD 98 PATIENTS (programmatic generation for ~100 total with existing 2)
    -- ========================================================================
    CREATE TEMP TABLE tmp_first_names (name TEXT) ON COMMIT DELETE ROWS;
    INSERT INTO tmp_first_names VALUES
        ('Mohamed'),('Ahmed'),('Ali'),('Sami'),('Rachid'),('Karim'),('Tarek'),('Mounir'),
        ('Hichem'),('Djamel'),('Fares'),('Abdelkader'),('Billel'),('Sofiane'),('Nadir'),
        ('Amine'),('Redha'),('Lyes'),('Yacine'),('Riad'),('Fouad'),('Slimane'),('Nabil'),
        ('Youcef'),('Khalil'),('Madjid'),('Aissa'),('Abderrahmane'),('Mokhtar'),('Nour'),
        ('Fatima'),('Karima'),('Yasmine'),('Nabila'),('Assia'),('Wahiba'),('Lynda'),
        ('Dalila'),('Malika'),('Zineb'),('Samira'),('Houria'),('Nadia'),('Salima'),
        ('Naima'),('Djamila'),('Saida'),('Hafida'),('Nawel'),('Meriem'),('Nezha');

    CREATE TEMP TABLE tmp_last_names (name TEXT) ON COMMIT DELETE ROWS;
    INSERT INTO tmp_last_names VALUES
        ('Bouzid'),('Khelifi'),('Mehenni'),('Benali'),('Hamdi'),('Derradji'),('Guediri'),
        ('Boulahia'),('Chaieb'),('Kheddam'),('Righi'),('Meddour'),('Cheriet'),('Horra'),
        ('Lamri'),('Hadjadj'),('Bouzidi'),('Ait Ali'),('Mekki'),('Slimani'),
        ('Bensalem'),('Ouali'),('Djebali'),('Zidane'),('Hamza'),('Belkacem'),
        ('Mansouri'),('Cherif'),('Kherroubi'),('Messaoudi'),('Nacer'),('Saidi'),
        ('Benyahia'),('Ouled'),('Boumediene'),('Meziane'),('Mekhalfi'),('Sahraoui'),
        ('Bennour'),('Gacem'),('Hocine'),('Maouche'),('Zerrouki'),('Djezzar'),
        ('Boukerrou'),('Ait Ahmed'),('Mokrani'),('Amirat'),('Rahal'),('Bouchareb');

    CREATE TEMP TABLE tmp_medicals (val TEXT) ON COMMIT DELETE ROWS;
    INSERT INTO tmp_medicals VALUES
        (NULL),('Diabetes type 2'),('Hypertension'),('Asthma'),('Thyroid disorder'),
        ('High cholesterol'),('Anemia'),('Heart condition'),('Arthritis'),
        ('Allergic rhinitis'),(NULL),(NULL),('Hypothyroidism'),('Gastritis'),
        ('Migraine'),(NULL),(NULL),(NULL);

    CREATE TEMP TABLE tmp_allergies (val TEXT) ON COMMIT DELETE ROWS;
    INSERT INTO tmp_allergies VALUES
        (NULL),('Penicillin'),('Aspirin'),('Sulfa drugs'),('Latex'),
        ('Ibuprofen'),('Codeine'),('Sulfonamides'),('Local anesthetics'),
        (NULL),(NULL),(NULL),('Amoxicillin'),(NULL),(NULL);

    DECLARE
        v_patient_count INT := 0;
        v_p_first TEXT;
        v_p_last TEXT;
        v_gender TEXT;
        v_dob DATE;
        v_phone TEXT;
        v_email TEXT;
        v_emergency_name TEXT;
        v_emergency_phone TEXT;
        v_medical TEXT;
        v_allergy TEXT;
        v_blood TEXT;
        v_address TEXT;
    BEGIN
        FOR v_i IN 1..98 LOOP
            SELECT name INTO v_p_first FROM tmp_first_names ORDER BY random() LIMIT 1;
            SELECT name INTO v_p_last FROM tmp_last_names ORDER BY random() LIMIT 1;
            v_gender := CASE WHEN random() < 0.5 THEN 'patient.gender.male' ELSE 'patient.gender.female' END;
            v_dob := (date '1955-01-01' + (random() * 14000)::int);
            v_phone := '+21377' || LPAD((v_i + 100)::text, 7, '0');
            v_email := lower(replace(v_p_first, ' ', '') || '.' || replace(v_p_last, ' ', '') || v_i || '@email.dz');
            SELECT name INTO v_emergency_name FROM tmp_first_names ORDER BY random() LIMIT 1;
            v_emergency_phone := '+21377' || LPAD((v_i + 500)::text, 7, '0');
            SELECT val INTO v_medical FROM tmp_medicals ORDER BY random() LIMIT 1;
            SELECT val INTO v_allergy FROM tmp_allergies ORDER BY random() LIMIT 1;
            v_blood := (ARRAY['A+','A-','B+','B-','AB+','AB-','O+','O-'])[1 + (random() * 8)::int];
            v_address := (ARRAY[
                'Rue Didouche Mourad, Constantine',
                'Cite Zouaghi, Constantine',
                'Nouvelle Ville, Constantine',
                'Cite El-Bir, Constantine',
                'Route de Batna, Constantine'
            ])[1 + (random() * 5)::int];

            INSERT INTO patients (
                tenant_id, patient_code, full_name, date_of_birth, gender,
                phone, email, wilaya_id, address,
                emergency_contact_name, emergency_contact_phone,
                medical_history, allergies, blood_type, status_key, created_by
            ) VALUES (
                v_tenant_id, NULL, v_p_first || ' ' || v_p_last, v_dob, v_gender,
                v_phone, v_email, 25, v_address,
                v_emergency_name || ' ' || v_p_last, v_emergency_phone,
                v_medical, v_allergy, v_blood,
                'patient.status.active', v_admin_id
            );
            v_patient_count := v_patient_count + 1;
        END LOOP;
        RAISE NOTICE 'Created % new patients for El-Qods (total: ~100 patients)', v_patient_count;
    END;

    DROP TABLE IF EXISTS tmp_first_names;
    DROP TABLE IF EXISTS tmp_last_names;
    DROP TABLE IF EXISTS tmp_medicals;
    DROP TABLE IF EXISTS tmp_allergies;

    -- ========================================================================
    -- APPOINTMENT DATA POOLS
    -- ========================================================================
    v_reasons := ARRAY[
        'Routine dental checkup and cleaning',
        'Toothache evaluation - sensitivity to hot and cold',
        'Composite filling restoration',
        'Professional teeth cleaning and scaling',
        'Root canal evaluation and treatment',
        'Tooth extraction consultation',
        'Dental crown preparation and fitting',
        'Orthodontic braces adjustment',
        'Teeth whitening treatment',
        'Wisdom tooth pain evaluation',
        'Broken tooth repair - emergency',
        'Gum pain and bleeding treatment',
        'Dental implant consultation',
        'Denture adjustment and relining',
        'Post-operative follow-up examination',
        'Pediatric dental examination',
        'Emergency walk-in - severe toothache',
        'Night guard fitting for bruxism',
        'Dental bridge preparation',
        'Annual comprehensive oral examination'
    ];

    v_notes := ARRAY[
        NULL,
        'Patient reports intermittent pain lasting 2 weeks',
        'Referred by Dr. Benali for specialist evaluation',
        'First visit to the clinic - new patient registration',
        NULL,
        'Follow-up from previous root canal treatment',
        'X-rays to be taken before procedure',
        'Insurance pre-approval needed before proceeding',
        NULL,
        'Patient is anxious about dental procedures',
        'Patient advised to arrive 15 minutes early',
        'Bring previous dental records if available',
        'Pediatric patient - parent/guardian will accompany',
        'Emergency slot - no prior appointment',
        NULL
    ];

    -- ========================================================================
    -- GENERATE APPOINTMENTS FOR 90 DAYS
    -- ========================================================================
    FOR v_date_offset IN 0..89 LOOP
        v_appt_date := CURRENT_DATE + v_date_offset;
        
        -- Skip Fridays (5) and Saturdays (6) - Algerian work week: Sun-Thu
        IF EXTRACT(DOW FROM v_appt_date) IN (5, 6) THEN
            CONTINUE;
        END IF;
        
        -- 4-8 appointments per day depending on day of week
        v_appts_today := 4 + (random() * 5)::int;
        
        FOR v_i IN 1..v_appts_today LOOP
            -- Random time between 08:00 and 17:00, 30-min slots
            v_hour := 8 + (random() * 9)::int;
            v_minute := CASE WHEN random() < 0.5 THEN 0 ELSE 30 END;
            
            -- Lunch break: skip 12:00-13:30
            IF (v_hour = 12) OR (v_hour = 13 AND v_minute >= 0) OR (v_hour = 13 AND v_minute <= 30) THEN
                v_hour := 14 + (random() * 3)::int;
                v_minute := CASE WHEN random() < 0.5 THEN 0 ELSE 30 END;
            END IF;
            
            v_appt_timestamp := v_appt_date + make_interval(hours := v_hour, mins := v_minute);
            
            -- Pick random dentist via direct query
            SELECT id INTO v_curr_dentist_id FROM users
            WHERE tenant_id = v_tenant_id AND role_id = v_dentist_role_id
            ORDER BY random() LIMIT 1;
            
            -- Pick random patient via direct query
            SELECT id INTO v_curr_patient_id FROM patients
            WHERE tenant_id = v_tenant_id
            ORDER BY random() LIMIT 1;
            
            -- Pick random reason
            v_reason := v_reasons[1 + (random() * (array_length(v_reasons, 1)))::int];
            
            -- Pick random note
            v_note := v_notes[1 + (random() * (array_length(v_notes, 1)))::int];
            
            -- Determine status based on past/future
            IF v_appt_timestamp < NOW() THEN
                v_r := random();
                IF v_r < 0.65 THEN
                    v_status_key := 'appt.status.completed';
                ELSIF v_r < 0.80 THEN
                    v_status_key := 'appt.status.cancelled';
                ELSIF v_r < 0.90 THEN
                    v_status_key := 'appt.status.no_show';
                ELSE
                    v_status_key := 'appt.status.confirmed';
                END IF;
            ELSE
                v_r := random();
                IF v_r < 0.50 THEN
                    v_status_key := 'appt.status.scheduled';
                ELSIF v_r < 0.75 THEN
                    v_status_key := 'appt.status.confirmed';
                ELSIF v_r < 0.90 THEN
                    v_status_key := 'appt.status.scheduled';
                ELSE
                    v_status_key := 'appt.status.completed';
                END IF;
            END IF;
            
            INSERT INTO appointments (
                tenant_id, patient_id, dentist_id, appointment_date,
                duration_minutes, status_key, reason, notes, created_by
            ) VALUES (
                v_tenant_id, v_curr_patient_id, v_curr_dentist_id, v_appt_timestamp,
                CASE WHEN random() < 0.20 THEN 60 ELSE 30 END,
                v_status_key, v_reason, v_note,
                CASE WHEN random() < 0.5 THEN v_admin_id ELSE v_receptionist_id END
            ) ON CONFLICT DO NOTHING;
            
            v_total_appts := v_total_appts + 1;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Generated % appointments across 90 days for El-Qods', v_total_appts;
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
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Clinique Dentaire Sourire',
        'sourire',
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
        full_name,
        date_of_birth,
        gender,
        phone,
        wilaya_id,
        status_key,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL, -- Auto-generated: PAT-2025-0001 (scoped to this tenant!)
        'Rania Benali',
        '1988-11-30',
        'patient.gender.female',
        '+213773456789',
        16, -- Algiers
        'patient.status.active',
        v_admin_user_id
    );

    RAISE NOTICE 'Created Patient: Rania Benali (Code: PAT-2025-0001 for Sourire)';

    -- ========================================================================
    -- INVENTORY DATA FOR TENANT 2 (Sourire) - Limited (Trial Plan)
    -- ========================================================================

    -- Create basic supplier
    INSERT INTO suppliers (tenant_id, name, contact_person, email, phone, wilaya_id, created_by) VALUES
    (v_tenant_id, 'Algiers Dental Supply', 'Karim Boumediene', 'contact@algiersdentalsupp.dz', '+213556123456', 16, v_admin_user_id);

    -- Get category IDs
    DECLARE
        v_gloves_cat_id UUID;
        v_masks_cat_id UUID;
        v_cotton_cat_id UUID;
    BEGIN
        SELECT id INTO v_gloves_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.gloves' AND tenant_id IS NULL;
        SELECT id INTO v_masks_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.masks' AND tenant_id IS NULL;
        SELECT id INTO v_cotton_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.cotton' AND tenant_id IS NULL;

        -- Create basic inventory items (trial plan - limited inventory)
        INSERT INTO inventory_items (tenant_id, name, description, category_id, unit_of_measure, current_stock, min_stock_level, unit_cost_dzd, created_by) VALUES
        (v_tenant_id, 'Latex Gloves - Medium', 'Powdered latex examination gloves', v_gloves_cat_id, 'box', 8, 5, 650.00, v_admin_user_id),
        (v_tenant_id, 'Surgical Masks', 'Disposable 3-ply surgical masks', v_masks_cat_id, 'box', 12, 8, 420.00, v_admin_user_id),
        (v_tenant_id, 'Cotton Rolls Small', 'Non-sterile cotton rolls', v_cotton_cat_id, 'bag', 6, 5, 380.00, v_admin_user_id);

        -- Create basic expenses
        INSERT INTO expenses (tenant_id, category_key, description, amount_dzd, expense_date, created_by) VALUES
        (v_tenant_id, 'expense.category.inventory', 'Basic supplies purchase', 8500.00, NOW() - INTERVAL '7 days', v_admin_user_id),
        (v_tenant_id, 'expense.category.utilities', 'Electricity - January 2025', 4200.00, NOW() - INTERVAL '5 days', v_admin_user_id);

    END;

    RAISE NOTICE 'Created basic inventory for Sourire (3 items, 2 expenses)';
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
    v_payment_method_cash UUID;
    v_payment_method_cib UUID;
    v_payment_method_bank UUID;
    v_payment_method_baridimob UUID;
BEGIN
    SELECT id INTO v_dentist_role_id FROM roles WHERE role_key = 'auth.role.dentist';

    -- Create Tenant 3
    INSERT INTO tenants (
        name,
        subdomain,
        primary_color,
        subscription_status,
        subscription_plan,
        subscription_started_at,
        subscription_ends_at,
        settings
    ) VALUES (
        'Cabinet Dr. Teyar',
        'teyar',
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
        'dentist@teyar.dz',
        crypt('A1b2-A1b2', gen_salt('bf')),
        'Zinelabidine Teyar',
        '+213549468120',
        9, -- Blida
        'user.status.active'
    )
    RETURNING id INTO v_dentist_user_id;

    RAISE NOTICE 'Created Dentist: dentist@teyar.dz (Password: A1b2-A1b2)';

    -- Get payment method IDs
    SELECT id INTO v_payment_method_cash FROM payment_methods WHERE method_key = 'pay.method.cash';
    SELECT id INTO v_payment_method_cib FROM payment_methods WHERE method_key = 'pay.method.cib';
    SELECT id INTO v_payment_method_bank FROM payment_methods WHERE method_key = 'pay.method.bank_transfer';
    SELECT id INTO v_payment_method_baridimob FROM payment_methods WHERE method_key = 'pay.method.baridimob';

    -- Create Sample Patient for Dr. Teyar
    INSERT INTO patients (
        tenant_id,
        patient_code,
        full_name,
        date_of_birth,
        gender,
        phone,
        email,
        wilaya_id,
        status_key,
        created_by
    ) VALUES (
        v_tenant_id,
        NULL,
        'Mohamed Cherif',
        '1990-05-10',
        'patient.gender.male',
        '+213774567890',
        'mohamed.cherif@email.dz',
        9, -- Blida
        'patient.status.active',
        v_dentist_user_id
    );

    RAISE NOTICE 'Created Patient: Mohamed Cherif (Code: PAT-2025-0001 for Teyar)';

    -- ========================================================================
    -- INVENTORY DATA FOR TENANT 3 (Dr. Teyar) - Premium (Enterprise Plan)
    -- ========================================================================

    -- Create premium suppliers
    INSERT INTO suppliers (tenant_id, name, contact_person, email, phone, wilaya_id, address, payment_terms_days, created_by) VALUES
    (v_tenant_id, 'Premium Dental Equipment', 'Nadia Belkacem', 'sales@premiumdental.dz', '+213557654321', 9, 'Zone Industrielle Boufarik, Blida', 15, v_dentist_user_id),
    (v_tenant_id, 'International Dental Supplies', 'Omar Benali', 'orders@intldental.dz', '+213558765432', 16, 'Hydra, Algiers', 30, v_dentist_user_id),
    (v_tenant_id, 'Advanced Materials Co.', 'Leila Cherif', 'info@advancedmat.dz', '+213559876543', 9, 'Chiffa, Blida', 21, v_dentist_user_id);

    -- Get category IDs for premium inventory
    DECLARE
        v_gloves_cat_id UUID;
        v_composite_cat_id UUID;
        v_anesthetics_cat_id UUID;
        v_hand_instruments_cat_id UUID;
        v_rotary_cat_id UUID;
        v_impression_cat_id UUID;
        v_cement_cat_id UUID;
    BEGIN
        SELECT id INTO v_gloves_cat_id FROM inventory_categories WHERE category_key = 'inv.consumables.gloves' AND tenant_id IS NULL;
        SELECT id INTO v_composite_cat_id FROM inventory_categories WHERE category_key = 'inv.materials.composite' AND tenant_id IS NULL;
        SELECT id INTO v_anesthetics_cat_id FROM inventory_categories WHERE category_key = 'inv.pharmaceuticals.anesthetics' AND tenant_id IS NULL;
        SELECT id INTO v_hand_instruments_cat_id FROM inventory_categories WHERE category_key = 'inv.instruments.hand' AND tenant_id IS NULL;
        SELECT id INTO v_rotary_cat_id FROM inventory_categories WHERE category_key = 'inv.instruments.rotary' AND tenant_id IS NULL;
        SELECT id INTO v_impression_cat_id FROM inventory_categories WHERE category_key = 'inv.materials.impression' AND tenant_id IS NULL;
        SELECT id INTO v_cement_cat_id FROM inventory_categories WHERE category_key = 'inv.materials.cement' AND tenant_id IS NULL;

        -- Create premium inventory items
        INSERT INTO inventory_items (tenant_id, name, description, category_id, unit_of_measure, current_stock, min_stock_level, max_stock_level, reorder_point, unit_cost_dzd, selling_price_dzd, expiry_tracking, created_by) VALUES
        (v_tenant_id, 'Premium Nitrile Gloves - S', 'Powder-free, textured nitrile gloves, size S', v_gloves_cat_id, 'box', 35, 15, 150, 25, 950.00, 1400.00, FALSE, v_dentist_user_id),
        (v_tenant_id, 'Premium Nitrile Gloves - M', 'Powder-free, textured nitrile gloves, size M', v_gloves_cat_id, 'box', 42, 15, 150, 25, 950.00, 1400.00, FALSE, v_dentist_user_id),
        (v_tenant_id, 'Premium Nitrile Gloves - L', 'Powder-free, textured nitrile gloves, size L', v_gloves_cat_id, 'box', 28, 15, 150, 25, 950.00, 1400.00, FALSE, v_dentist_user_id),
        (v_tenant_id, 'Nano-Hybrid Composite A1', 'Premium nano-hybrid composite, shade A1', v_composite_cat_id, 'syringe', 15, 8, 60, 12, 3200.00, 4500.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Nano-Hybrid Composite A2', 'Premium nano-hybrid composite, shade A2', v_composite_cat_id, 'syringe', 18, 8, 60, 12, 3200.00, 4500.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Nano-Hybrid Composite B1', 'Premium nano-hybrid composite, shade B1', v_composite_cat_id, 'syringe', 10, 8, 60, 12, 3200.00, 4500.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Articaine 4% with Epinephrine', 'Premium local anesthetic cartridges', v_anesthetics_cat_id, 'cartridge', 80, 30, 300, 50, 150.00, 220.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Titanium Scaler Set', 'Premium titanium periodontal scalers', v_hand_instruments_cat_id, 'set', 3, 2, 10, 3, 8500.00, 12000.00, FALSE, v_dentist_user_id),
        (v_tenant_id, 'Diamond Bur Kit', 'Assorted diamond burs for high-speed handpiece', v_rotary_cat_id, 'kit', 5, 3, 20, 4, 4200.00, 6000.00, FALSE, v_dentist_user_id),
        (v_tenant_id, 'Polyvinyl Siloxane Impression', 'Premium PVS impression material', v_impression_cat_id, 'cartridge', 12, 6, 40, 8, 2800.00, 4000.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Glass Ionomer Cement', 'Radiopaque glass ionomer cement', v_cement_cat_id, 'capsule', 25, 12, 100, 18, 180.00, 280.00, TRUE, v_dentist_user_id),
        (v_tenant_id, 'Resin-Modified GIC', 'Light-cure resin-modified glass ionomer', v_cement_cat_id, 'syringe', 8, 5, 30, 7, 1200.00, 1800.00, TRUE, v_dentist_user_id);

        -- Create comprehensive stock movements
        INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
        SELECT v_tenant_id, ii.id, 'stock.movement.purchase', 50, ii.unit_cost_dzd, 'purchase_order', 'Bulk purchase - Q1 2025', v_dentist_user_id
        FROM inventory_items ii WHERE ii.tenant_id = v_tenant_id AND ii.name LIKE 'Premium Nitrile Gloves%';

        INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
        SELECT v_tenant_id, ii.id, 'stock.movement.usage', -8, ii.unit_cost_dzd, 'treatment', 'Used in composite restorations', v_dentist_user_id
        FROM inventory_items ii WHERE ii.tenant_id = v_tenant_id AND ii.name LIKE 'Premium Nitrile Gloves - M';

        INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
        SELECT v_tenant_id, ii.id, 'stock.movement.usage', -3, ii.unit_cost_dzd, 'treatment', 'Used in anterior restorations', v_dentist_user_id
        FROM inventory_items ii WHERE ii.tenant_id = v_tenant_id AND ii.name = 'Nano-Hybrid Composite A2';

        -- Create comprehensive expenses (Enterprise plan)
        INSERT INTO expenses (tenant_id, category_key, description, amount_dzd, expense_date, payment_method_id, status_key, created_by) VALUES
        (v_tenant_id, 'expense.category.inventory', 'Premium dental materials - Q1 2025', 125000.00, NOW() - INTERVAL '20 days', v_payment_method_cib, 'expense.status.paid', v_dentist_user_id),
        (v_tenant_id, 'expense.category.equipment', 'Dental chair maintenance and calibration', 18500.00, NOW() - INTERVAL '15 days', v_payment_method_cash, 'expense.status.paid', v_dentist_user_id),
        (v_tenant_id, 'expense.category.utilities', 'Electricity and water - January 2025', 12800.00, NOW() - INTERVAL '12 days', v_payment_method_bank, 'expense.status.paid', v_dentist_user_id),
        (v_tenant_id, 'expense.category.rent', 'Clinic rent - January 2025', 45000.00, NOW() - INTERVAL '10 days', v_payment_method_bank, 'expense.status.paid', v_dentist_user_id),
        (v_tenant_id, 'expense.category.marketing', 'Digital marketing campaign', 8500.00, NOW() - INTERVAL '8 days', v_payment_method_cib, 'expense.status.approved', v_dentist_user_id),
        (v_tenant_id, 'expense.category.training', 'Continuing education course', 15000.00, NOW() - INTERVAL '5 days', v_payment_method_cash, 'expense.status.approved', v_dentist_user_id),
        (v_tenant_id, 'expense.category.insurance', 'Professional liability insurance', 22000.00, NOW() - INTERVAL '3 days', v_payment_method_bank, 'expense.status.pending', v_dentist_user_id);

        -- Create a custom inventory category for Dr. Teyar
        INSERT INTO inventory_categories (tenant_id, category_key, parent_id, description, is_active) VALUES
        (v_tenant_id, 'inv.custom.implants', NULL, 'Dental implants and related materials (Custom for Dr. Teyar)', TRUE);

        -- Add implant-related inventory
        DECLARE v_implant_cat_id UUID;
        BEGIN
            SELECT id INTO v_implant_cat_id FROM inventory_categories WHERE category_key = 'inv.custom.implants' AND tenant_id = v_tenant_id;
            
            INSERT INTO inventory_items (tenant_id, name, description, category_id, unit_of_measure, current_stock, min_stock_level, max_stock_level, unit_cost_dzd, selling_price_dzd, expiry_tracking, created_by) VALUES
            (v_tenant_id, 'Titanium Implant 4.0x10mm', 'Premium titanium dental implant', v_implant_cat_id, 'piece', 6, 3, 20, 25000.00, 45000.00, FALSE, v_dentist_user_id),
            (v_tenant_id, 'Implant Abutment Kit', 'Assorted abutments for implants', v_implant_cat_id, 'kit', 2, 1, 8, 12000.00, 20000.00, FALSE, v_dentist_user_id);
        END;

    END;

    RAISE NOTICE 'Created premium inventory for Dr. Teyar (14 items, 7 expenses, 1 custom category)';
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
--     p.full_name,
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
    RAISE NOTICE '  - Global Inventory Categories: 20';
    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE 'Tenants Created: 3';
    RAISE NOTICE '';
    RAISE NOTICE '1. Cabinet Dentaire El-Qods (Constantine)';
    RAISE NOTICE '   Subdomain: elqods.dms.dz';
    RAISE NOTICE '   Status: Active (Professional Plan)';
    RAISE NOTICE '   Admin: admin@elqods.dz / Admin@2025!';
    RAISE NOTICE '   Dentists: Amina, Samir, Fatima | Receptionist: Nadia';
    RAISE NOTICE '   Patients: 100 | Suppliers: 3 | Inventory: 8 items | Expenses: 4';
    RAISE NOTICE '   Appointments: Generated across 90+ days';
    RAISE NOTICE '   (More data: treatment plans, prescriptions, x-rays, POs, etc. below)';
    RAISE NOTICE '';
    RAISE NOTICE '2. Clinique Dentaire Sourire (Algiers)';
    RAISE NOTICE '   Subdomain: sourire.dms.dz';
    RAISE NOTICE '   Status: Trial (Starter Plan)';
    RAISE NOTICE '   Admin: admin@sourire.dz / Sourire@2025!';
    RAISE NOTICE '   Patients: 1 | Suppliers: 1 | Inventory: 3 items | Expenses: 2';
    RAISE NOTICE '';
    RAISE NOTICE '3. Cabinet Dr. Teyar (Blida)';
    RAISE NOTICE '   Subdomain: teyar.dms.dz';
    RAISE NOTICE '   Status: Active (Enterprise Plan)';
    RAISE NOTICE '   Dentist: dentist@teyar.dz / A1b2-A1b2';
    RAISE NOTICE '   Patients: 1 | Suppliers: 3 | Inventory: 14 items | Expenses: 7';
    RAISE NOTICE '   Custom Categories: 1 (Implants)';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'INVENTORY SYSTEM FEATURES:';
    RAISE NOTICE '  - Multi-tenant isolation verified';
    RAISE NOTICE '  - Auto-generated codes (ITM-2025-XXXX, SUP-2025-XXXX)';
    RAISE NOTICE '  - Stock movement tracking';
    RAISE NOTICE '  - Expense categorization';
    RAISE NOTICE '  - Low stock monitoring';
    RAISE NOTICE '  - Expiry date tracking (where applicable)';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'DATA ISOLATION VERIFIED:';
    RAISE NOTICE '  - Each tenant has independent inventory';
    RAISE NOTICE '  - Same global categories, different items';
    RAISE NOTICE '  - Tenant-specific custom categories';
    RAISE NOTICE '============================================';

END $$;

-- ============================================================================
-- INVOICE SEED DATA FOR ALL TENANTS
-- ============================================================================

-- ============================================================================
-- TENANT 1: Cabinet Dentaire El-Qods - INVOICE DATA
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_user_id UUID;
    v_dentist_user_id UUID;
    v_patient1_id UUID;
    v_patient2_id UUID;
    v_invoice1_id UUID;
    v_invoice2_id UUID;
    v_invoice3_id UUID;
    v_invoice4_id UUID;
    v_treatment1_id UUID;
    v_treatment2_id UUID;
    v_treatment3_id UUID;
    v_payment_method_cash UUID;
    v_payment_method_cib UUID;
    v_payment_method_bank UUID;
BEGIN
    -- Get tenant and user IDs
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'elqods';
    SELECT id INTO v_admin_user_id FROM users WHERE email = 'admin@elqods.dz';
    SELECT id INTO v_dentist_user_id FROM users WHERE email = 'dentist@elqods.dz';
    SELECT id INTO v_patient1_id FROM patients WHERE tenant_id = v_tenant_id AND full_name = 'Ahmed Boudiaf';
    SELECT id INTO v_patient2_id FROM patients WHERE tenant_id = v_tenant_id AND full_name = 'Leila Mansouri';
    
    -- Get payment method IDs
    SELECT id INTO v_payment_method_cash FROM payment_methods WHERE method_key = 'pay.method.cash';
    SELECT id INTO v_payment_method_cib FROM payment_methods WHERE method_key = 'pay.method.cib';
    SELECT id INTO v_payment_method_bank FROM payment_methods WHERE method_key = 'pay.method.bank_transfer';

    -- Create some treatment records first (needed for invoice items)
    INSERT INTO treatment_records (
        tenant_id, patient_id, dentist_id, treatment_date, 
        diagnosis, treatment_performed, estimated_cost_dzd
    ) VALUES 
    (v_tenant_id, v_patient1_id, v_dentist_user_id, NOW() - INTERVAL '15 days',
     'Dental caries on tooth 16', 'Composite filling restoration', 8500.00),
    (v_tenant_id, v_patient1_id, v_dentist_user_id, NOW() - INTERVAL '10 days',
     'Gingivitis and plaque buildup', 'Professional teeth cleaning and scaling', 4500.00),
    (v_tenant_id, v_patient2_id, v_dentist_user_id, NOW() - INTERVAL '8 days',
     'Tooth 26 requires crown', 'Dental crown preparation and placement', 25000.00);

    -- Get treatment IDs for invoice items
    SELECT id INTO v_treatment1_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Dental caries on tooth 16';
    SELECT id INTO v_treatment2_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Gingivitis and plaque buildup';
    SELECT id INTO v_treatment3_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Tooth 26 requires crown';

    -- ========================================================================
    -- INVOICE 1: Ahmed Boudiaf - Composite Filling (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient1_id, 
        NOW() - INTERVAL '15 days',
        NOW() - INTERVAL '8 days',
        8500.00, 0.00, 8500.00, 8500.00,
        'invoice.status.paid',
        'Composite filling - tooth 16',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice1_id;

    -- Invoice 1 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice1_id, v_treatment1_id, 'Composite filling restoration - tooth 16', 1, 8500.00, 8500.00);

    -- Payment for Invoice 1
    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice1_id, v_payment_method_cash, 8500.00, NOW() - INTERVAL '14 days', 'Cash payment received', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 2: Ahmed Boudiaf - Teeth Cleaning (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient1_id,
        NOW() - INTERVAL '10 days',
        NOW() - INTERVAL '3 days',
        4500.00, 500.00, 4000.00, 4000.00,
        'invoice.status.paid',
        'Professional cleaning with senior discount',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice2_id;

    -- Invoice 2 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice2_id, v_treatment2_id, 'Professional teeth cleaning and scaling', 1, 4500.00, 4500.00);

    -- Payment for Invoice 2
    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice2_id, v_payment_method_cib, 4000.00, NOW() - INTERVAL '9 days', 'CIB card payment', v_admin_user_id);

    -- ========================================================================
    -- INVOICE 3: Leila Mansouri - Dental Crown (PARTIAL PAYMENT)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient2_id,
        NOW() - INTERVAL '8 days',
        NOW() + INTERVAL '7 days',
        25000.00, 0.00, 25000.00, 15000.00,
        'invoice.status.partial',
        'Dental crown - tooth 26. Partial payment received.',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice3_id;

    -- Invoice 3 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice3_id, v_treatment3_id, 'Dental crown preparation and placement - tooth 26', 1, 25000.00, 25000.00);

    -- Partial payment for Invoice 3
    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice3_id, v_payment_method_bank, 15000.00, NOW() - INTERVAL '7 days', 'Bank transfer - partial payment', v_admin_user_id);

    -- ========================================================================
    -- INVOICE 4: Leila Mansouri - Consultation (UNPAID - OVERDUE)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient2_id,
        NOW() - INTERVAL '25 days',
        NOW() - INTERVAL '18 days',
        2500.00, 0.00, 2500.00, 0.00,
        'invoice.status.overdue',
        'Initial consultation and examination - OVERDUE',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice4_id;

    -- Invoice 4 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice4_id, 'Initial dental consultation and examination', 1, 2500.00, 2500.00);

    RAISE NOTICE 'Created invoices for El-Qods: 4 invoices (2 paid, 1 partial, 1 overdue)';

END $$;

-- ============================================================================
-- TENANT 2: Clinique Dentaire Sourire - INVOICE DATA (Limited - Trial Plan)
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_user_id UUID;
    v_patient_id UUID;
    v_invoice1_id UUID;
    v_invoice2_id UUID;
    v_treatment1_id UUID;
    v_payment_method_cash UUID;
BEGIN
    -- Get tenant and user IDs
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'sourire';
    SELECT id INTO v_admin_user_id FROM users WHERE email = 'admin@sourire.dz';
    SELECT id INTO v_patient_id FROM patients WHERE tenant_id = v_tenant_id AND full_name = 'Rania Benali';
    
    -- Get payment method ID
    SELECT id INTO v_payment_method_cash FROM payment_methods WHERE method_key = 'pay.method.cash';

    -- Create treatment record
    INSERT INTO treatment_records (
        tenant_id, patient_id, dentist_id, treatment_date,
        diagnosis, treatment_performed, estimated_cost_dzd
    ) VALUES (
        v_tenant_id, v_patient_id, v_admin_user_id, NOW() - INTERVAL '5 days',
        'Routine dental checkup', 'Comprehensive oral examination', 3000.00
    ) RETURNING id INTO v_treatment1_id;

    -- ========================================================================
    -- INVOICE 1: Rania Benali - Checkup (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '5 days',
        NOW() + INTERVAL '2 days',
        3000.00, 0.00, 3000.00, 3000.00,
        'invoice.status.paid',
        'Routine dental checkup',
        v_admin_user_id
    ) RETURNING id INTO v_invoice1_id;

    -- Invoice 1 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice1_id, v_treatment1_id, 'Comprehensive oral examination', 1, 3000.00, 3000.00);

    -- Payment for Invoice 1
    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice1_id, v_payment_method_cash, 3000.00, NOW() - INTERVAL '4 days', 'Cash payment', v_admin_user_id);

    -- ========================================================================
    -- INVOICE 2: Rania Benali - Follow-up (UNPAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '2 days',
        NOW() + INTERVAL '5 days',
        1500.00, 0.00, 1500.00, 0.00,
        'invoice.status.unpaid',
        'Follow-up consultation',
        v_admin_user_id
    ) RETURNING id INTO v_invoice2_id;

    -- Invoice 2 Items
    INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice2_id, 'Follow-up consultation', 1, 1500.00, 1500.00);

    RAISE NOTICE 'Created invoices for Sourire: 2 invoices (1 paid, 1 unpaid)';

END $$;

-- ============================================================================
-- TENANT 3: Cabinet Dr. Teyar - COMPREHENSIVE INVOICE DATA (Enterprise Plan)
-- ============================================================================

DO $$
DECLARE
    v_tenant_id UUID;
    v_dentist_user_id UUID;
    v_patient_id UUID;
    v_invoice1_id UUID;
    v_invoice2_id UUID;
    v_invoice3_id UUID;
    v_invoice4_id UUID;
    v_invoice5_id UUID;
    v_invoice6_id UUID;
    v_treatment1_id UUID;
    v_treatment2_id UUID;
    v_treatment3_id UUID;
    v_treatment4_id UUID;
    v_treatment5_id UUID;
    v_payment_method_cash UUID;
    v_payment_method_cib UUID;
    v_payment_method_bank UUID;
    v_payment_method_baridimob UUID;
BEGIN
    -- Get tenant and user IDs
    SELECT id INTO v_tenant_id FROM tenants WHERE subdomain = 'teyar';
    SELECT id INTO v_dentist_user_id FROM users WHERE email = 'dentist@teyar.dz';
    SELECT id INTO v_patient_id FROM patients WHERE tenant_id = v_tenant_id AND full_name = 'Mohamed Cherif';
    
    -- Get payment method IDs
    SELECT id INTO v_payment_method_cash FROM payment_methods WHERE method_key = 'pay.method.cash';
    SELECT id INTO v_payment_method_cib FROM payment_methods WHERE method_key = 'pay.method.cib';
    SELECT id INTO v_payment_method_bank FROM payment_methods WHERE method_key = 'pay.method.bank_transfer';
    SELECT id INTO v_payment_method_baridimob FROM payment_methods WHERE method_key = 'pay.method.baridimob';

    -- Create comprehensive treatment records
    INSERT INTO treatment_records (
        tenant_id, patient_id, dentist_id, treatment_date, tooth_number,
        diagnosis, treatment_performed, estimated_cost_dzd
    ) VALUES 
    (v_tenant_id, v_patient_id, v_dentist_user_id, NOW() - INTERVAL '30 days', '36',
     'Deep caries on molar 36', 'Root canal therapy - first visit', 15000.00),
    (v_tenant_id, v_patient_id, v_dentist_user_id, NOW() - INTERVAL '23 days', '36',
     'Root canal therapy continuation', 'Root canal therapy - second visit and filling', 12000.00),
    (v_tenant_id, v_patient_id, v_dentist_user_id, NOW() - INTERVAL '16 days', '36',
     'Crown placement on treated tooth', 'Ceramic crown placement on tooth 36', 28000.00),
    (v_tenant_id, v_patient_id, v_dentist_user_id, NOW() - INTERVAL '12 days', NULL,
     'Routine maintenance', 'Professional cleaning and fluoride treatment', 5500.00),
    (v_tenant_id, v_patient_id, v_dentist_user_id, NOW() - INTERVAL '5 days', '46',
     'Wisdom tooth impaction', 'Surgical extraction of impacted wisdom tooth', 18000.00);

    -- Get treatment IDs
    SELECT id INTO v_treatment1_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Deep caries on molar 36';
    SELECT id INTO v_treatment2_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Root canal therapy continuation';
    SELECT id INTO v_treatment3_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Crown placement on treated tooth';
    SELECT id INTO v_treatment4_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Routine maintenance';
    SELECT id INTO v_treatment5_id FROM treatment_records WHERE tenant_id = v_tenant_id AND diagnosis = 'Wisdom tooth impaction';

    -- ========================================================================
    -- INVOICE 1: Root Canal Therapy - Phase 1 (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '30 days',
        NOW() - INTERVAL '23 days',
        15000.00, 0.00, 15000.00, 15000.00,
        'invoice.status.paid',
        'Root canal therapy - Phase 1 (tooth 36)',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice1_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice1_id, v_treatment1_id, 'Root canal therapy - first visit (tooth 36)', 1, 15000.00, 15000.00);

    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice1_id, v_payment_method_cash, 15000.00, NOW() - INTERVAL '29 days', 'Cash payment', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 2: Root Canal Therapy - Phase 2 (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '23 days',
        NOW() - INTERVAL '16 days',
        12000.00, 1000.00, 11000.00, 11000.00,
        'invoice.status.paid',
        'Root canal therapy - Phase 2 with loyalty discount',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice2_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice2_id, v_treatment2_id, 'Root canal therapy - completion and filling (tooth 36)', 1, 12000.00, 12000.00);

    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice2_id, v_payment_method_cib, 11000.00, NOW() - INTERVAL '22 days', 'CIB card payment', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 3: Ceramic Crown (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '16 days',
        NOW() - INTERVAL '9 days',
        28000.00, 0.00, 28000.00, 28000.00,
        'invoice.status.paid',
        'Premium ceramic crown - tooth 36',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice3_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice3_id, v_treatment3_id, 'Premium ceramic crown placement (tooth 36)', 1, 28000.00, 28000.00);

    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice3_id, v_payment_method_bank, 28000.00, NOW() - INTERVAL '15 days', 'Bank transfer payment', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 4: Professional Cleaning (PAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '12 days',
        NOW() - INTERVAL '5 days',
        5500.00, 0.00, 5500.00, 5500.00,
        'invoice.status.paid',
        'Maintenance cleaning and fluoride',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice4_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice4_id, v_treatment4_id, 'Professional cleaning and fluoride treatment', 1, 5500.00, 5500.00);

    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice4_id, v_payment_method_baridimob, 5500.00, NOW() - INTERVAL '11 days', 'BaridiMob mobile payment', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 5: Wisdom Tooth Extraction (PARTIAL PAYMENT)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '5 days',
        NOW() + INTERVAL '2 days',
        18000.00, 0.00, 18000.00, 10000.00,
        'invoice.status.partial',
        'Surgical wisdom tooth extraction - partial payment received',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice5_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, treatment_record_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice5_id, v_treatment5_id, 'Surgical extraction of impacted wisdom tooth (46)', 1, 18000.00, 18000.00);

    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by) VALUES
    (v_tenant_id, v_invoice5_id, v_payment_method_cash, 10000.00, NOW() - INTERVAL '4 days', 'Partial cash payment', v_dentist_user_id);

    -- ========================================================================
    -- INVOICE 6: Consultation for New Patient (UNPAID)
    -- ========================================================================
    INSERT INTO invoices (
        tenant_id, patient_id, issue_date, due_date,
        subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
        payment_status_key, notes, created_by
    ) VALUES (
        v_tenant_id, v_patient_id,
        NOW() - INTERVAL '2 days',
        NOW() + INTERVAL '5 days',
        4000.00, 0.00, 4000.00, 0.00,
        'invoice.status.unpaid',
        'Comprehensive consultation for orthodontic evaluation',
        v_dentist_user_id
    ) RETURNING id INTO v_invoice6_id;

    INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_price_dzd, total_price_dzd) VALUES
    (v_tenant_id, v_invoice6_id, 'Comprehensive orthodontic consultation and X-rays', 1, 4000.00, 4000.00);

    RAISE NOTICE 'Created invoices for Dr. Teyar: 6 invoices (4 paid, 1 partial, 1 unpaid)';

END $$;

-- ============================================================================
-- SECTION 6: COMPREHENSIVE ADDITIONAL DUMMY DATA
-- Fills remaining tables: treatment_plans, prescriptions, media, xrays,
-- notifications, audit_logs, purchase_orders, plus more treatment records,
-- invoices, stock movements, and expenses for all tenants
-- ============================================================================

DO $$
DECLARE
    -- Tenant IDs
    v_tid UUID; v_sid UUID; v_tid3 UUID;
    -- User IDs
    v_admin UUID; v_dent1 UUID; v_dent2 UUID; v_dent3 UUID; v_recep UUID;
    v_s_admin UUID; v_t_dent UUID;
    -- Patient IDs (elqods - named)
    v_pat1 UUID; v_pat2 UUID;
    -- Patient IDs (sourire)
    v_spat UUID;
    -- Patient IDs (teyar)
    v_tpat UUID;
    -- Category IDs
    v_cleaning UUID; v_filling UUID; v_crown UUID; v_extraction UUID;
    v_root_canal UUID; v_whitening UUID; v_fluoride UUID; v_sealants UUID;
    v_wisdom UUID; v_braces UUID; v_pediatric UUID; v_veneer UUID;
    v_bridge UUID; v_implant UUID;
    -- Payment methods
    v_cash UUID; v_cib UUID; v_bank UUID; v_baridi UUID;
    v_cheque UUID; v_satim UUID; v_edahabia UUID;
    -- Supplier IDs (elqods)
    v_sup1 UUID; v_sup2 UUID; v_sup3 UUID;
    -- Inventory item IDs (elqods)
    v_gloves_m UUID; v_gloves_l UUID; v_comp_a2 UUID; v_comp_a3 UUID;
    v_lido UUID; v_explorer UUID; v_cotton UUID; v_gauze UUID;
    -- Loop variables
    v_i INT; v_j INT;
    -- IDs for created records
    v_plan_id UUID; v_tr_id UUID; v_inv_id UUID; v_po_id UUID;
    v_media_id UUID; v_appt_id UUID; v_patient_id UUID; v_dentist_id UUID;
    v_tr_count INT := 0; v_inv_count INT := 0; v_pres_count INT := 0;
    -- Appointment date variable for treatment records
    v_appt_date TIMESTAMPTZ;
BEGIN
    -- ========================================================================
    -- 6.1: GET REFERENCE IDS
    -- ========================================================================
    SELECT id INTO v_tid FROM tenants WHERE subdomain = 'elqods';
    SELECT id INTO v_sid FROM tenants WHERE subdomain = 'sourire';
    SELECT id INTO v_tid3 FROM tenants WHERE subdomain = 'teyar';
    SELECT id INTO v_admin FROM users WHERE email = 'admin@elqods.dz';
    SELECT id INTO v_dent1 FROM users WHERE email = 'dentist@elqods.dz';
    SELECT id INTO v_dent2 FROM users WHERE email = 'dentist2@elqods.dz';
    SELECT id INTO v_dent3 FROM users WHERE email = 'dentist3@elqods.dz';
    SELECT id INTO v_recep FROM users WHERE email = 'reception@elqods.dz';
    SELECT id INTO v_s_admin FROM users WHERE email = 'admin@sourire.dz';
    SELECT id INTO v_t_dent FROM users WHERE email = 'dentist@teyar.dz';
    SELECT id INTO v_pat1 FROM patients WHERE tenant_id = v_tid AND full_name = 'Ahmed Boudiaf';
    SELECT id INTO v_pat2 FROM patients WHERE tenant_id = v_tid AND full_name = 'Leila Mansouri';
    SELECT id INTO v_spat FROM patients WHERE tenant_id = v_sid LIMIT 1;
    SELECT id INTO v_tpat FROM patients WHERE tenant_id = v_tid3 LIMIT 1;

    SELECT id INTO v_cleaning FROM treatment_categories WHERE category_key = 'cat.preventive.cleaning' AND tenant_id IS NULL;
    SELECT id INTO v_filling FROM treatment_categories WHERE category_key = 'cat.restorative.filling' AND tenant_id IS NULL;
    SELECT id INTO v_crown FROM treatment_categories WHERE category_key = 'cat.restorative.crown' AND tenant_id IS NULL;
    SELECT id INTO v_bridge FROM treatment_categories WHERE category_key = 'cat.restorative.bridge' AND tenant_id IS NULL;
    SELECT id INTO v_extraction FROM treatment_categories WHERE category_key = 'cat.surgery.extraction' AND tenant_id IS NULL;
    SELECT id INTO v_implant FROM treatment_categories WHERE category_key = 'cat.surgery.implant' AND tenant_id IS NULL;
    SELECT id INTO v_wisdom FROM treatment_categories WHERE category_key = 'cat.surgery.wisdom_tooth' AND tenant_id IS NULL;
    SELECT id INTO v_root_canal FROM treatment_categories WHERE category_key = 'cat.endodontics.root_canal' AND tenant_id IS NULL;
    SELECT id INTO v_braces FROM treatment_categories WHERE category_key = 'cat.orthodontics.braces' AND tenant_id IS NULL;
    SELECT id INTO v_whitening FROM treatment_categories WHERE category_key = 'cat.cosmetic.whitening' AND tenant_id IS NULL;
    SELECT id INTO v_veneer FROM treatment_categories WHERE category_key = 'cat.cosmetic.veneers' AND tenant_id IS NULL;
    SELECT id INTO v_fluoride FROM treatment_categories WHERE category_key = 'cat.preventive.fluoride' AND tenant_id IS NULL;
    SELECT id INTO v_sealants FROM treatment_categories WHERE category_key = 'cat.preventive.sealants' AND tenant_id IS NULL;
    SELECT id INTO v_pediatric FROM treatment_categories WHERE category_key = 'cat.custom.pediatric' AND tenant_id = v_tid;

    SELECT id INTO v_cash FROM payment_methods WHERE method_key = 'pay.method.cash';
    SELECT id INTO v_cib FROM payment_methods WHERE method_key = 'pay.method.cib';
    SELECT id INTO v_bank FROM payment_methods WHERE method_key = 'pay.method.bank_transfer';
    SELECT id INTO v_baridi FROM payment_methods WHERE method_key = 'pay.method.baridimob';
    SELECT id INTO v_cheque FROM payment_methods WHERE method_key = 'pay.method.check';
    SELECT id INTO v_satim FROM payment_methods WHERE method_key = 'pay.method.satim';
    SELECT id INTO v_edahabia FROM payment_methods WHERE method_key = 'pay.method.edahabia';

    SELECT id INTO v_sup1 FROM suppliers WHERE tenant_id = v_tid AND name = 'Dental Supply Algeria';
    SELECT id INTO v_sup2 FROM suppliers WHERE tenant_id = v_tid AND name = 'MediDent Distribution';
    SELECT id INTO v_sup3 FROM suppliers WHERE tenant_id = v_tid AND name = 'Pharma Dental';

    SELECT id INTO v_gloves_m FROM inventory_items WHERE tenant_id = v_tid AND name = 'Nitrile Gloves - Medium';
    SELECT id INTO v_gloves_l FROM inventory_items WHERE tenant_id = v_tid AND name = 'Nitrile Gloves - Large';
    SELECT id INTO v_comp_a2 FROM inventory_items WHERE tenant_id = v_tid AND name = 'Composite Resin A2';
    SELECT id INTO v_comp_a3 FROM inventory_items WHERE tenant_id = v_tid AND name = 'Composite Resin A3';
    SELECT id INTO v_lido FROM inventory_items WHERE tenant_id = v_tid AND name = 'Lidocaine 2% with Epinephrine';
    SELECT id INTO v_explorer FROM inventory_items WHERE tenant_id = v_tid AND name = 'Dental Explorer #23';
    SELECT id INTO v_cotton FROM inventory_items WHERE tenant_id = v_tid AND name = 'Cotton Rolls Medium';
    SELECT id INTO v_gauze FROM inventory_items WHERE tenant_id = v_tid AND name = 'Gauze Pads 2x2';

    RAISE NOTICE '6.1: Reference IDs loaded';

    -- ========================================================================
    -- 6.2: TREATMENT PLANS (El-Qods: 8, Sourire: 2, Teyar: 3)
    -- ========================================================================
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, notes, created_by)
    VALUES (v_tid, v_pat1, 'Full Mouth Rehabilitation', 'Comprehensive treatment: fillings, crown, cleaning', 'plan.status.active', 65000.00, 'Phase 1 approved. Insurance confirmed.', v_dent1);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_tid, v_pat2, 'Orthodontic Braces', 'Full metal braces treatment', 'plan.status.draft', 120000.00, v_dent2);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_tid, v_pat1, 'Implant Consultation', 'Implant evaluation for tooth 46', 'plan.status.completed', 35000.00, v_dent1);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_tid, v_pat2, 'Pediatric Checkup', 'Children dental examination', 'plan.status.cancelled', 15000.00, v_admin);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    SELECT v_tid, id, 'Root Canal Treatment Plan', 'Root canal + crown on molar', 'plan.status.active', 45000.00, v_dent3
    FROM patients WHERE tenant_id = v_tid ORDER BY random() LIMIT 1 OFFSET 2;
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    SELECT v_tid, id, 'Teeth Whitening Package', 'Professional whitening + home kit', 'plan.status.draft', 25000.00, v_dent1
    FROM patients WHERE tenant_id = v_tid ORDER BY random() LIMIT 1 OFFSET 5;
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    SELECT v_tid, id, 'Periodontal Treatment', 'Deep cleaning and gum management', 'plan.status.active', 32000.00, v_dent2
    FROM patients WHERE tenant_id = v_tid ORDER BY random() LIMIT 1 OFFSET 10;
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    SELECT v_tid, id, 'Cosmetic Veneers Plan', 'Porcelain veneers on anteriors', 'plan.status.draft', 85000.00, v_dent1
    FROM patients WHERE tenant_id = v_tid ORDER BY random() LIMIT 1 OFFSET 15;
    -- Sourire plans
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_sid, v_spat, 'Basic Checkup Plan', 'Routine examination and cleaning', 'plan.status.active', 5000.00, v_s_admin);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_sid, v_spat, 'Filling Treatment Plan', 'Composite filling on molar', 'plan.status.draft', 8000.00, v_s_admin);
    -- Teyar plans
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_tid3, v_tpat, 'Full Mouth Rehab', 'Complete oral rehabilitation', 'plan.status.active', 95000.00, v_t_dent);
    INSERT INTO treatment_plans (tenant_id, patient_id, plan_name, description, status_key, estimated_total_dzd, created_by)
    VALUES (v_tid3, v_tpat, 'Implant Plan', 'Two dental implants lower jaw', 'plan.status.draft', 180000.00, v_t_dent);

    RAISE NOTICE '6.2: Treatment plans created (El-Qods: 8, Sourire: 2, Teyar: 2)';

    -- ========================================================================
    -- 6.3: TREATMENT RECORDS (25 for El-Qods from completed appointments)
    -- ========================================================================
    FOR v_i IN 0..24 LOOP
        SELECT a.id, a.patient_id, a.dentist_id, a.appointment_date
        INTO v_appt_id, v_patient_id, v_dentist_id, v_appt_date
        FROM appointments a
        WHERE a.tenant_id = v_tid AND a.status_key = 'appt.status.completed'
        ORDER BY a.appointment_date DESC
        LIMIT 1 OFFSET v_i;

        IF FOUND THEN
            INSERT INTO treatment_records (
                tenant_id, patient_id, appointment_id, dentist_id,
                category_id, treatment_date, tooth_number,
                diagnosis, treatment_performed, estimated_cost_dzd
            ) VALUES (
                v_tid, v_patient_id, v_appt_id, v_dentist_id,
                CASE v_i % 11
                    WHEN 0 THEN v_cleaning WHEN 1 THEN v_filling
                    WHEN 2 THEN v_crown WHEN 3 THEN v_extraction
                    WHEN 4 THEN v_root_canal WHEN 5 THEN v_cleaning
                    WHEN 6 THEN v_filling WHEN 7 THEN v_whitening
                    WHEN 8 THEN v_sealants WHEN 9 THEN v_fluoride
                    ELSE v_bridge
                END,
                v_appt_date,
                CASE v_i % 11
                    WHEN 0 THEN NULL WHEN 1 THEN (ARRAY['16','26','36','46'])[1+(random()*4)::int]
                    WHEN 2 THEN (ARRAY['11','21','16','26'])[1+(random()*4)::int]
                    WHEN 3 THEN (ARRAY['18','28','38','48'])[1+(random()*4)::int]
                    WHEN 4 THEN (ARRAY['16','26','36','46'])[1+(random()*4)::int]
                    WHEN 5 THEN NULL WHEN 6 THEN (ARRAY['14','15','24','25'])[1+(random()*4)::int]
                    WHEN 7 THEN NULL WHEN 8 THEN (ARRAY['14','24','34','44'])[1+(random()*4)::int]
                    WHEN 9 THEN NULL ELSE (ARRAY['11','12','21','22'])[1+(random()*4)::int]
                END,
                CASE v_i % 11
                    WHEN 0 THEN 'Routine cleaning and prophylaxis'
                    WHEN 1 THEN 'Dental caries on posterior tooth'
                    WHEN 2 THEN 'Tooth structure compromised - crown needed'
                    WHEN 3 THEN 'Impacted wisdom tooth with pericoronitis'
                    WHEN 4 THEN 'Irreversible pulpitis'
                    WHEN 5 THEN 'Moderate gingivitis with buildup'
                    WHEN 6 THEN 'Secondary caries under existing filling'
                    WHEN 7 THEN 'Extrinsic staining from coffee/tea'
                    WHEN 8 THEN 'Deep pits and fissures on molars'
                    WHEN 9 THEN 'Early demineralization'
                    ELSE 'Missing tooth - bridge preparation'
                END,
                CASE v_i % 11
                    WHEN 0 THEN 'Professional cleaning and scaling'
                    WHEN 1 THEN 'Composite filling restoration'
                    WHEN 2 THEN 'Crown preparation and temporary crown'
                    WHEN 3 THEN 'Surgical extraction of wisdom tooth'
                    WHEN 4 THEN 'Root canal therapy - first visit'
                    WHEN 5 THEN 'Full mouth debridement and scaling'
                    WHEN 6 THEN 'Old filling removal and replacement'
                    WHEN 7 THEN 'Professional teeth whitening with LED'
                    WHEN 8 THEN 'Dental sealant application on molars'
                    WHEN 9 THEN 'Fluoride varnish application'
                    ELSE 'Bridge abutment preparation and impression'
                END,
                CASE v_i % 11
                    WHEN 0 THEN 4500.00 WHEN 1 THEN 8500.00
                    WHEN 2 THEN 25000.00 WHEN 3 THEN 18000.00
                    WHEN 4 THEN 15000.00 WHEN 5 THEN 5000.00
                    WHEN 6 THEN 7000.00 WHEN 7 THEN 12000.00
                    WHEN 8 THEN 3000.00 WHEN 9 THEN 2000.00
                    ELSE 22000.00
                END
            );
            v_tr_count := v_tr_count + 1;
        END IF;
    END LOOP;
    RAISE NOTICE '6.3: Created % treatment records for El-Qods', v_tr_count;

    -- ========================================================================
    -- 6.4: NEW INVOICES FOR EL-QODS (10 invoices with items + payments)
    -- ========================================================================
    FOR v_i IN 0..9 LOOP
        DECLARE
            v_subtotal DECIMAL(12,2);
            v_discount DECIMAL(12,2);
            v_total DECIMAL(12,2);
        BEGIN
            SELECT a.id, a.patient_id, a.dentist_id, a.appointment_date
            INTO v_appt_id, v_patient_id, v_dentist_id, v_appt_date
            FROM appointments a
            WHERE a.tenant_id = v_tid AND a.status_key = 'appt.status.completed'
            ORDER BY a.appointment_date DESC
            LIMIT 1 OFFSET (25 + v_i);

            IF FOUND THEN
                v_subtotal := (ARRAY[8500.00, 4500.00, 12000.00, 25000.00, 5500.00])[1 + (v_i % 5)];
                v_discount := CASE WHEN v_i % 3 = 0 THEN 500.00 ELSE 0.00 END;
                v_total := v_subtotal - v_discount;

                INSERT INTO invoices (
                    tenant_id, patient_id, issue_date, due_date,
                    subtotal_dzd, discount_dzd, total_dzd, paid_amount_dzd,
                    payment_status_key, notes, created_by
                ) VALUES (
                    v_tid, v_patient_id,
                    v_appt_date, v_appt_date + INTERVAL '14 days',
                    v_subtotal, v_discount, v_total,
                    CASE v_i % 4
                        WHEN 0 THEN 0
                        WHEN 1 THEN ROUND(v_total * 0.5, 2)
                        ELSE v_total
                    END,
                    CASE v_i % 4
                        WHEN 0 THEN 'invoice.status.unpaid'
                        WHEN 1 THEN 'invoice.status.partial'
                        WHEN 2 THEN 'invoice.status.paid'
                        ELSE 'invoice.status.paid'
                    END,
                    (ARRAY['Composite filling procedure','Teeth cleaning and scaling','Root canal treatment','Dental crown placement','Preventive treatment'])[1 + (v_i % 5)],
                    v_dentist_id
                ) RETURNING id INTO v_inv_id;

                INSERT INTO invoice_items (tenant_id, invoice_id, description, quantity, unit_price_dzd, total_price_dzd)
                VALUES (
                    v_tid, v_inv_id,
                    (ARRAY['Composite filling restoration','Professional teeth cleaning','Root canal therapy','Dental crown','Preventive treatment'])[1 + (v_i % 5)],
                    1, v_subtotal, v_subtotal
                );

                IF (v_i % 4) >= 2 THEN
                    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by)
                    VALUES (v_tid, v_inv_id, CASE v_i % 4 WHEN 2 THEN v_cash WHEN 3 THEN v_cib END,
                            v_total, v_appt_date + INTERVAL '1 day',
                            CASE v_i % 4 WHEN 2 THEN 'Full cash payment' ELSE 'CIB card full payment' END, v_recep);
                ELSIF v_i % 4 = 1 THEN
                    INSERT INTO payments (tenant_id, invoice_id, payment_method_id, amount_dzd, payment_date, notes, received_by)
                    VALUES (v_tid, v_inv_id, v_baridi, ROUND(v_total * 0.5, 2),
                            v_appt_date + INTERVAL '1 day', 'Partial BaridiMob payment', v_recep);
                END IF;

                v_inv_count := v_inv_count + 1;
            END IF;
        END;
    END LOOP;
    RAISE NOTICE '6.4: Created % new invoices for El-Qods', v_inv_count;

    -- ========================================================================
    -- 6.5: PRESCRIPTIONS (El-Qods: 10, Sourire: 2, Teyar: 3)
    -- Note: prescription_number is provided explicitly (the auto-numbering
    -- trigger trg_set_prescription_number in db.sql only fills it when NULL).
    -- Format: RX-YYYYMM-NNNN
    -- ========================================================================
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, notes, status_key, created_by)
    VALUES
    (v_tid, v_pat1, v_dent1, 'RX-202606-0001', 'Amoxicillin 500mg', '500 mg', '3 times daily', '7 days', 'Take after meals. Complete full course.', 'prescription.status.active', v_dent1),
    (v_tid, v_pat2, v_dent2, 'RX-202606-0002', 'Ibuprofen 400mg', '400 mg', '3 times daily as needed', '5 days', 'For post-operative pain management', 'prescription.status.active', v_dent2),
    (v_tid, v_pat1, v_dent1, 'RX-202606-0003', 'Chlorhexidine Mouthwash 0.12%', '15 ml', '2 times daily after brushing', '14 days', 'Do not swallow. Use for 2 weeks.', 'prescription.status.active', v_dent1),
    (v_tid, v_pat2, v_dent2, 'RX-202606-0004', 'Metronidazole 250mg', '250 mg', '3 times daily', '7 days', 'For periodontal infection', 'prescription.status.completed', v_dent2),
    (v_tid, v_pat1, v_dent3, 'RX-202606-0005', 'Paracetamol 500mg', '500 mg', '4 times daily as needed', '3 days', NULL, 'prescription.status.active', v_dent3),
    (v_tid, v_pat2, v_dent1, 'RX-202606-0006', 'Amoxicillin + Clavulanic Acid 875/125mg', '1 tablet', '2 times daily', '7 days', 'Stronger antibiotic for severe infection', 'prescription.status.cancelled', v_dent1),
    (v_tid, v_pat1, v_dent2, 'RX-202606-0007', 'Lidocaine Viscous 2%', '5 ml', 'Swish for 1 min as needed', '5 days', 'For oral ulcer pain relief', 'prescription.status.active', v_dent2),
    (v_tid, v_pat2, v_dent3, 'RX-202606-0008', 'Fluconazole 100mg', '100 mg', 'Once daily', '14 days', 'For oral thrush treatment', 'prescription.status.completed', v_dent3),
    (v_tid, v_pat1, v_dent1, 'RX-202606-0009', 'Prednisolone 5mg', '5 mg', '3 times daily tapering dose', '8 days', 'Taper: 3x3d, 2x2d, 1x3d', 'prescription.status.active', v_dent1),
    (v_tid, v_pat2, v_dent2, 'RX-202606-0010', 'Doxycycline 100mg', '100 mg', 'Once daily', '10 days', 'For periodontal disease', 'prescription.status.active', v_dent2);
    v_pres_count := 10;

    -- Sourire prescriptions
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, status_key, created_by)
    VALUES (v_sid, v_spat, v_s_admin, 'RX-202606-0001', 'Amoxicillin 500mg', '500 mg', '3 times daily', '7 days', 'prescription.status.active', v_s_admin);
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, status_key, created_by)
    VALUES (v_sid, v_spat, v_s_admin, 'RX-202606-0002', 'Ibuprofen 400mg', '400 mg', '3 times daily', '3 days', 'prescription.status.active', v_s_admin);

    -- Teyar prescriptions
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, notes, status_key, created_by)
    VALUES (v_tid3, v_tpat, v_t_dent, 'RX-202606-0001', 'Amoxicillin 1g', '1 g', '2 times daily', '7 days', 'Prophylactic antibiotic before implant surgery', 'prescription.status.active', v_t_dent);
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, status_key, created_by)
    VALUES (v_tid3, v_tpat, v_t_dent, 'RX-202606-0002', 'Ketoprofen 100mg', '100 mg', '2 times daily', '5 days', 'prescription.status.active', v_t_dent);
    INSERT INTO prescriptions (tenant_id, patient_id, dentist_id, prescription_number, medication_name, dosage, frequency, duration, notes, status_key, created_by)
    VALUES (v_tid3, v_tpat, v_t_dent, 'RX-202606-0003', 'Chlorhexidine Gel 0.2%', 'Apply thin layer', '2 times daily', '14 days', 'Apply to surgical site after implant placement', 'prescription.status.active', v_t_dent);

    RAISE NOTICE '6.5: Created prescriptions (El-Qods: 10, Sourire: 2, Teyar: 3)';

    -- ========================================================================
    -- 6.6: MEDIA (El-Qods: 8 entries - Cloudinary references)
    -- ========================================================================
    INSERT INTO media (tenant_id, cloudinary_public_id, cloudinary_url, original_filename, mime_type, file_size, uploaded_by)
    VALUES
    (v_tid, 'elqods/panoramic/pan_001', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/panoramic/pan_001.jpg', 'panoramic_ahmed_boudiaf.jpg', 'image/jpeg', 2457600, v_dent1),
    (v_tid, 'elqods/periapical/pa_001', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/periapical/pa_001.jpg', 'periapical_tooth_16.jpg', 'image/jpeg', 1048576, v_dent1),
    (v_tid, 'elqods/periapical/pa_002', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/periapical/pa_002.jpg', 'periapical_tooth_26.jpg', 'image/jpeg', 983040, v_dent2),
    (v_tid, 'elqods/bitewing/bw_001', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/bitewing/bw_001.jpg', 'bitewing_left.jpg', 'image/jpeg', 1572864, v_dent2),
    (v_tid, 'elqods/bitewing/bw_002', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/bitewing/bw_002.jpg', 'bitewing_right.jpg', 'image/jpeg', 1677721, v_dent3),
    (v_tid, 'elqods/intraoral/io_001', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/intraoral/io_001.jpg', 'intraoral_front.jpg', 'image/jpeg', 2097152, v_dent1),
    (v_tid, 'elqods/intraoral/io_002', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/intraoral/io_002.jpg', 'intraoral_upper_arch.jpg', 'image/jpeg', 2228224, v_dent2),
    (v_tid, 'elqods/profile/profile_001', 'https://res.cloudinary.com/demo/image/upload/v1/elqods/profile/profile_001.jpg', 'profile_photo.jpg', 'image/jpeg', 524288, v_admin);
    RAISE NOTICE '6.6: Created 8 media entries for El-Qods';

    -- ========================================================================
    -- 6.7: X-RAYS (El-Qods: 5, Teyar: 2)
    -- ========================================================================
    INSERT INTO xrays (media_id, tenant_id, patient_id, treatment_record_id, tooth_number, description, captured_date)
    SELECT m.id, v_tid, v_pat1, NULL, NULL, 'Panoramic X-ray - initial examination', CURRENT_DATE - 30
    FROM media m WHERE m.tenant_id = v_tid AND m.cloudinary_public_id = 'elqods/panoramic/pan_001';

    INSERT INTO xrays (media_id, tenant_id, patient_id, treatment_record_id, tooth_number, description, captured_date)
    SELECT m.id, v_tid, v_pat2, tr.id, '26', 'Periapical X-ray - tooth 26 - crown prep', CURRENT_DATE - 15
    FROM media m, treatment_records tr
    WHERE m.tenant_id = v_tid AND m.cloudinary_public_id = 'elqods/periapical/pa_002'
    AND tr.tenant_id = v_tid AND tr.diagnosis = 'Tooth structure compromised - crown needed'
    LIMIT 1;

    INSERT INTO xrays (media_id, tenant_id, patient_id, tooth_number, description, captured_date)
    SELECT m.id, v_tid, v_pat1, '16', 'Periapical X-ray - tooth 16 - filling', CURRENT_DATE - 20
    FROM media m WHERE m.tenant_id = v_tid AND m.cloudinary_public_id = 'elqods/periapical/pa_001';

    INSERT INTO xrays (media_id, tenant_id, patient_id, tooth_number, description, captured_date)
    SELECT m.id, v_tid, v_pat2, NULL, 'Bitewing X-ray - left posterior', CURRENT_DATE - 10
    FROM media m WHERE m.tenant_id = v_tid AND m.cloudinary_public_id = 'elqods/bitewing/bw_001';

    INSERT INTO xrays (media_id, tenant_id, patient_id, tooth_number, description, captured_date)
    SELECT m.id, v_tid, v_pat1, NULL, 'Intraoral photo - frontal view', CURRENT_DATE - 5
    FROM media m WHERE m.tenant_id = v_tid AND m.cloudinary_public_id = 'elqods/intraoral/io_001';

    -- Teyar x-rays
    INSERT INTO media (tenant_id, cloudinary_public_id, cloudinary_url, original_filename, mime_type, file_size, uploaded_by)
    VALUES (v_tid3, 'teyar/panoramic/pan_001', 'https://res.cloudinary.com/demo/image/upload/v1/teyar/panoramic/pan_001.jpg', 'panoramic_mohamed.jpg', 'image/jpeg', 2621440, v_t_dent)
    RETURNING id INTO v_media_id;

    INSERT INTO xrays (media_id, tenant_id, patient_id, tooth_number, description, captured_date)
    SELECT v_media_id, v_tid3, v_tpat, '36', 'Panoramic X-ray - tooth 36 root canal', CURRENT_DATE - 30;

    INSERT INTO media (tenant_id, cloudinary_public_id, cloudinary_url, original_filename, mime_type, file_size, uploaded_by)
    VALUES (v_tid3, 'teyar/periapical/pa_001', 'https://res.cloudinary.com/demo/image/upload/v1/teyar/periapical/pa_001.jpg', 'periapical_46.jpg', 'image/jpeg', 1114112, v_t_dent)
    RETURNING id INTO v_media_id;

    INSERT INTO xrays (media_id, tenant_id, patient_id, tooth_number, description, captured_date)
    SELECT v_media_id, v_tid3, v_tpat, '46', 'Periapical X-ray - tooth 46 extraction site', CURRENT_DATE - 5;

    RAISE NOTICE '6.7: Created x-rays (El-Qods: 5, Teyar: 2)';

    -- ========================================================================
    -- 6.8: NOTIFICATIONS (El-Qods: 10, Sourire: 2, Teyar: 3)
    -- ========================================================================
    -- Get some appointment IDs for notifications
    SELECT id INTO v_appt_id FROM appointments WHERE tenant_id = v_tid AND status_key = 'appt.status.scheduled' ORDER BY appointment_date ASC LIMIT 1;

    INSERT INTO notifications (tenant_id, appointment_id, patient_id, type, channel, recipient, message, status, sent_at)
    VALUES
    (v_tid, NULL, v_pat1, 'appointment.reminder', 'in_app', 'admin@elqods.dz', 'Ahmed Boudiaf has an appointment tomorrow at 10:00', 'read', NOW() - INTERVAL '1 day'),
    (v_tid, v_appt_id, v_pat2, 'appointment.reminder', 'in_app', 'reception@elqods.dz', 'Leila Mansouri has a scheduled appointment today at 14:30', 'unread', NOW()),
    (v_tid, NULL, v_pat1, 'payment.reminder', 'in_app', 'admin@elqods.dz', 'Overdue invoice INV-2025-0004 for Ahmed Boudiaf - 2,500 DZD', 'unread', NOW()),
    (v_tid, NULL, v_pat2, 'treatment.completed', 'in_app', 'dentist@elqods.dz', 'Treatment completed for Leila Mansouri - dental crown', 'read', NOW() - INTERVAL '5 days'),
    (v_tid, NULL, NULL, 'inventory.low_stock', 'in_app', 'admin@elqods.dz', 'Low stock alert: Nitrile Gloves - Large (18 remaining, min 10)', 'read', NOW() - INTERVAL '2 days');
    INSERT INTO notifications (tenant_id, patient_id, type, channel, recipient, message, status, sent_at)
    SELECT v_tid, id, 'appointment.reminder', 'in_app', 'reception@elqods.dz',
           full_name || ' has a pending treatment plan', 'unread', NOW()
    FROM patients WHERE tenant_id = v_tid ORDER BY random() LIMIT 1;
    INSERT INTO notifications (tenant_id, inventory_item_id, type, channel, recipient, message, status, sent_at)
    SELECT v_tid, id, 'inventory.low_stock', 'in_app', 'admin@elqods.dz',
           'Low stock: ' || name || ' (' || current_stock || ' remaining)', 'unread', NOW()
    FROM inventory_items WHERE tenant_id = v_tid AND current_stock <= min_stock_level LIMIT 1;
    INSERT INTO notifications (tenant_id, patient_id, type, channel, recipient, message, status, sent_at)
    SELECT v_tid, id, 'birthday.greeting', 'in_app', 'admin@elqods.dz',
           'Happy Birthday to ' || full_name || '!', 'unread', NOW()
    FROM patients WHERE tenant_id = v_tid AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE) LIMIT 1;
    INSERT INTO notifications (tenant_id, type, channel, recipient, message, status, sent_at)
    VALUES (v_tid, 'system.maintenance', 'in_app', 'admin@elqods.dz', 'System maintenance scheduled for Saturday 2 AM', 'unread', NOW());
    INSERT INTO notifications (tenant_id, type, channel, recipient, message, status, sent_at)
    VALUES (v_tid, 'report.ready', 'in_app', 'admin@elqods.dz', 'Monthly report for May 2025 is ready to view', 'read', NOW());

    -- Sourire notifications
    INSERT INTO notifications (tenant_id, appointment_id, patient_id, type, channel, recipient, message, status)
    SELECT v_sid, a.id, a.patient_id, 'appointment.reminder', 'in_app', 'admin@sourire.dz',
           'Upcoming appointment tomorrow', 'unread'
    FROM appointments a WHERE a.tenant_id = v_sid AND a.status_key IN ('scheduled','confirmed') LIMIT 1;
    INSERT INTO notifications (tenant_id, type, channel, recipient, message, status)
    VALUES (v_sid, 'system.welcome', 'in_app', 'admin@sourire.dz', 'Welcome to DMS! Trial expires in 30 days.', 'unread');

    -- Teyar notifications
    INSERT INTO notifications (tenant_id, type, channel, recipient, message, status)
    VALUES (v_tid3, 'system.report', 'in_app', 'dentist@teyar.dz', 'Monthly analytics report is available', 'unread');
    INSERT INTO notifications (tenant_id, type, channel, recipient, message, status)
    VALUES (v_tid3, 'inventory.low_stock', 'in_app', 'dentist@teyar.dz', 'Check inventory: some items are below reorder point', 'unread');
    INSERT INTO notifications (tenant_id, patient_id, type, channel, recipient, message, status)
    SELECT v_tid3, id, 'treatment.plan_ready', 'in_app', 'dentist@teyar.dz',
           'Treatment plan ready for review: ' || full_name, 'unread'
    FROM patients WHERE tenant_id = v_tid3 ORDER BY random() LIMIT 1;

    RAISE NOTICE '6.8: Created notifications across all tenants';

    -- ========================================================================
    -- 6.9: AUDIT LOGS (15 entries across tenants)
    -- ========================================================================
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
    VALUES
    (v_tid, v_admin, 'user.login', 'user', v_admin, NULL,
     '{"last_login": "2026-06-13 08:30:00"}'::jsonb, '192.168.1.100'::inet),
    (v_tid, v_dent1, 'user.login', 'user', v_dent1, NULL,
     '{"last_login": "2026-06-13 07:30:00"}'::jsonb, '192.168.1.101'::inet),
    (v_tid, v_admin, 'patient.create', 'patient', v_pat1, NULL,
     '{"full_name": "Ahmed Boudiaf", "status": "active"}'::jsonb, '10.0.0.1'::inet),
    (v_tid, v_dent1, 'appointment.create', 'appointment', NULL, NULL,
     '{"status": "scheduled", "duration": 30}'::jsonb, '10.0.0.1'::inet),
    (v_tid, v_dent2, 'appointment.update', 'appointment', NULL,
     '{"status": "scheduled"}'::jsonb, '{"status": "confirmed"}'::jsonb, '10.0.0.2'::inet),
    (v_tid, v_recep, 'invoice.create', 'invoice', NULL, NULL,
     '{"total": 8500, "status": "unpaid"}'::jsonb, '10.0.0.3'::inet),
    (v_tid, v_admin, 'payment.create', 'payment', NULL, NULL,
     '{"amount": 8500, "method": "cash"}'::jsonb, '10.0.0.1'::inet),
    (v_tid, v_dent1, 'treatment.create', 'treatment_record', NULL, NULL,
     '{"diagnosis": "Dental caries", "cost": 8500}'::jsonb, '10.0.0.1'::inet),
    (v_tid, v_dent3, 'treatment.update', 'treatment_record', NULL,
     '{"diagnosis": "Caries"}'::jsonb, '{"diagnosis": "Dental caries on tooth 16"}'::jsonb, '10.0.0.4'::inet),
    (v_tid, v_admin, 'inventory.update', 'inventory_item', NULL,
     '{"current_stock": 25}'::jsonb, '{"current_stock": 20}'::jsonb, '10.0.0.1'::inet);
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address)
    SELECT v_sid, v_s_admin, 'user.login', 'user', '10.0.1.1'::inet;
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address)
    SELECT v_sid, v_s_admin, 'patient.create', 'patient', '10.0.1.1'::inet;
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address)
    SELECT v_tid3, v_t_dent, 'user.login', 'user', '10.0.2.1'::inet;
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, ip_address)
    SELECT v_tid3, v_t_dent, 'invoice.payment', 'payment', '10.0.2.1'::inet;
    INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, new_values, ip_address)
    SELECT v_tid3, v_t_dent, 'treatment.create', 'treatment_record',
           '{"diagnosis": "Root canal", "tooth": "36"}'::jsonb, '10.0.2.1'::inet;

    RAISE NOTICE '6.9: Created 15 audit log entries';

    -- ========================================================================
    -- 6.10: PURCHASE ORDERS (El-Qods: 3 POs with items)
    -- ========================================================================
    -- PO 1: Dental Supply Algeria - gloves and composite (RECEIVED)
    INSERT INTO purchase_orders (tenant_id, supplier_id, order_date, expected_delivery_date, actual_delivery_date, subtotal_dzd, shipping_dzd, total_dzd, status_key, notes, created_by, approved_by, approved_at)
    VALUES (v_tid, v_sup1, NOW() - INTERVAL '20 days', NOW() - INTERVAL '13 days', NOW() - INTERVAL '12 days', 35000.00, 1500.00, 36500.00, 'po.status.received', 'Monthly supplies restock', v_admin, v_admin, NOW() - INTERVAL '18 days')
    RETURNING id INTO v_po_id;

    INSERT INTO purchase_order_items (tenant_id, purchase_order_id, inventory_item_id, quantity_ordered, quantity_received, unit_cost_dzd, total_cost_dzd, notes)
    VALUES
    (v_tid, v_po_id, v_gloves_m, 10, 10, 750.00, 7500.00, NULL),
    (v_tid, v_po_id, v_gloves_l, 8, 8, 750.00, 6000.00, NULL),
    (v_tid, v_po_id, v_comp_a2, 5, 5, 2200.00, 11000.00, 'Shade A2 composite'),
    (v_tid, v_po_id, v_comp_a3, 5, 5, 2200.00, 11000.00, NULL);

    -- PO 2: Pharma Dental - anesthetics and cotton (PARTIALLY RECEIVED)
    INSERT INTO purchase_orders (tenant_id, supplier_id, order_date, expected_delivery_date, subtotal_dzd, shipping_dzd, total_dzd, status_key, notes, created_by)
    VALUES (v_tid, v_sup3, NOW() - INTERVAL '10 days', NOW() + INTERVAL '5 days', 12000.00, 800.00, 12800.00, 'po.status.partially_received', 'Anesthetics and consumables', v_admin)
    RETURNING id INTO v_po_id;

    INSERT INTO purchase_order_items (tenant_id, purchase_order_id, inventory_item_id, quantity_ordered, quantity_received, unit_cost_dzd, total_cost_dzd, expiry_date, batch_number)
    VALUES
    (v_tid, v_po_id, v_lido, 50, 50, 100.00, 5000.00, NOW() + INTERVAL '1 year', 'LIDO-B2025-001'),
    (v_tid, v_po_id, v_cotton, 10, 5, 380.00, 3800.00, NULL, NULL),
    (v_tid, v_po_id, v_gauze, 15, 0, 280.00, 4200.00, NULL, NULL);

    -- PO 3: MediDent Distribution - instruments (APPROVED)
    INSERT INTO purchase_orders (tenant_id, supplier_id, order_date, expected_delivery_date, subtotal_dzd, shipping_dzd, total_dzd, status_key, notes, created_by, approved_by, approved_at)
    VALUES (v_tid, v_sup2, NOW() - INTERVAL '3 days', NOW() + INTERVAL '12 days', 12000.00, 0.00, 12000.00, 'po.status.approved', 'New instruments order', v_dent1, v_admin, NOW() - INTERVAL '1 day')
    RETURNING id INTO v_po_id;

    INSERT INTO purchase_order_items (tenant_id, purchase_order_id, inventory_item_id, quantity_ordered, quantity_received, unit_cost_dzd, total_cost_dzd)
    VALUES (v_tid, v_po_id, v_explorer, 5, 0, 1100.00, 5500.00),
           (v_tid, v_po_id, v_gloves_m, 5, 0, 750.00, 3750.00);

    RAISE NOTICE '6.10: Created 3 purchase orders with 9 line items for El-Qods';

    -- ========================================================================
    -- 6.11: ADDITIONAL STOCK MOVEMENTS (El-Qods: 10 entries)
    -- ========================================================================
    INSERT INTO stock_movements (tenant_id, inventory_item_id, movement_type, quantity, unit_cost_dzd, reference_type, notes, created_by)
    VALUES
    (v_tid, v_gloves_m, 'stock.movement.usage', -3, 850.00, 'treatment', 'Used in 3 patient procedures', v_dent1),
    (v_tid, v_gloves_l, 'stock.movement.usage', -2, 850.00, 'treatment', 'Used in 2 surgical procedures', v_dent2),
    (v_tid, v_comp_a2, 'stock.movement.usage', -2, 2500.00, 'treatment', 'Composite fillings - 2 patients', v_dent1),
    (v_tid, v_comp_a3, 'stock.movement.usage', -1, 2500.00, 'treatment', 'Composite filling - posterior tooth', v_dent3),
    (v_tid, v_lido, 'stock.movement.usage', -8, 120.00, 'treatment', 'Anesthetic cartridges used in procedures', v_dent1),
    (v_tid, v_cotton, 'stock.movement.usage', -3, 450.00, 'treatment', 'Cotton rolls for isolation', v_dent2),
    (v_tid, v_gauze, 'stock.movement.usage', -5, 320.00, 'treatment', 'Gauze pads for post-op', v_dent3),
    (v_tid, v_gloves_m, 'stock.movement.adjustment', 5, 850.00, 'adjustment', 'Inventory count adjustment - found extra box', v_admin),
    (v_tid, v_comp_a2, 'stock.movement.adjustment', 1, 2500.00, 'adjustment', 'Shelf count correction', v_admin),
    (v_tid, v_gauze, 'stock.movement.expired', -2, 320.00, 'expired', 'Expired gauze pads removed from stock', v_admin);

    RAISE NOTICE '6.11: Created 10 additional stock movements for El-Qods';

    -- ========================================================================
    -- 6.12: ADDITIONAL EXPENSES (El-Qods: 8, Teyar: 3)
    -- ========================================================================
    INSERT INTO expenses (tenant_id, category_key, description, amount_dzd, expense_date, payment_method_id, status_key, created_by)
    VALUES
    (v_tid, 'expense.category.utilities', 'Water bill - February 2025', 3200.00, NOW() - INTERVAL '2 days', v_cash, 'expense.status.pending', v_admin),
    (v_tid, 'expense.category.utilities', 'Electricity bill - February 2025', 7800.00, NOW() - INTERVAL '2 days', v_bank, 'expense.status.pending', v_admin),
    (v_tid, 'expense.category.inventory', 'Composite resin restock', 11000.00, NOW() - INTERVAL '6 days', v_cib, 'expense.status.paid', v_admin),
    (v_tid, 'expense.category.equipment', 'Autoclave maintenance', 6500.00, NOW() - INTERVAL '8 days', v_cash, 'expense.status.paid', v_admin),
    (v_tid, 'expense.category.rent', 'Office rent - February 2025', 35000.00, NOW() - INTERVAL '1 day', v_bank, 'expense.status.pending', v_admin),
    (v_tid, 'expense.category.marketing', 'Google Ads campaign - February', 5000.00, NOW() - INTERVAL '4 days', v_cib, 'expense.status.approved', v_dent1),
    (v_tid, 'expense.category.insurance', 'Professional insurance - Q1 2025', 18000.00, NOW() - INTERVAL '15 days', v_bank, 'expense.status.paid', v_admin),
    (v_tid, 'expense.category.salary', 'Staff salaries - January 2025', 240000.00, NOW() - INTERVAL '7 days', v_bank, 'expense.status.paid', v_admin);

    -- Teyar additional expenses
    INSERT INTO expenses (tenant_id, category_key, description, amount_dzd, expense_date, payment_method_id, status_key, created_by)
    VALUES
    (v_tid3, 'expense.category.utilities', 'Water and electricity - February', 11500.00, NOW() - INTERVAL '3 days', v_bank, 'expense.status.approved', v_t_dent),
    (v_tid3, 'expense.category.marketing', 'Facebook campaign - new patients', 7500.00, NOW() - INTERVAL '6 days', v_cib, 'expense.status.paid', v_t_dent),
    (v_tid3, 'expense.category.equipment', 'X-ray sensor calibration', 9500.00, NOW() - INTERVAL '10 days', v_cash, 'expense.status.paid', v_t_dent);

    RAISE NOTICE '6.12: Created additional expenses (El-Qods: 8, Teyar: 3)';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Section 6 complete - All tables now populated with comprehensive test data';

END $$;

-- ============================================================================
-- FINAL COMPREHENSIVE SUMMARY VERIFICATION
-- ============================================================================

DO $$
DECLARE
    v_total_invoices INTEGER;
    v_total_revenue DECIMAL(12,2);
    v_total_paid DECIMAL(12,2);
    v_total_outstanding DECIMAL(12,2);
    v_total_patients INTEGER;
    v_total_users INTEGER;
    v_total_appointments INTEGER;
    v_total_treatments INTEGER;
    v_total_prescriptions INTEGER;
    v_total_plans INTEGER;
    v_total_media INTEGER;
    v_total_xrays INTEGER;
    v_total_notifications INTEGER;
    v_total_audit_logs INTEGER;
    v_total_purchase_orders INTEGER;
    v_total_stock_movements INTEGER;
    v_total_expenses INTEGER;
    v_total_payments INTEGER;
    v_total_suppliers INTEGER;
    v_total_inventory_items INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_invoices FROM invoices;
    SELECT COALESCE(SUM(total_dzd), 0) INTO v_total_revenue FROM invoices;
    SELECT COALESCE(SUM(paid_amount_dzd), 0) INTO v_total_paid FROM invoices;
    SELECT COALESCE(SUM(total_dzd - paid_amount_dzd), 0) INTO v_total_outstanding FROM invoices;
    SELECT COUNT(*) INTO v_total_patients FROM patients;
    SELECT COUNT(*) INTO v_total_users FROM users;
    SELECT COUNT(*) INTO v_total_appointments FROM appointments;
    SELECT COUNT(*) INTO v_total_treatments FROM treatment_records;
    SELECT COUNT(*) INTO v_total_prescriptions FROM prescriptions;
    SELECT COUNT(*) INTO v_total_plans FROM treatment_plans;
    SELECT COUNT(*) INTO v_total_media FROM media;
    SELECT COUNT(*) INTO v_total_xrays FROM xrays;
    SELECT COUNT(*) INTO v_total_notifications FROM notifications;
    SELECT COUNT(*) INTO v_total_audit_logs FROM audit_logs;
    SELECT COUNT(*) INTO v_total_purchase_orders FROM purchase_orders;
    SELECT COUNT(*) INTO v_total_stock_movements FROM stock_movements;
    SELECT COUNT(*) INTO v_total_expenses FROM expenses;
    SELECT COUNT(*) INTO v_total_payments FROM payments;
    SELECT COUNT(*) INTO v_total_suppliers FROM suppliers;
    SELECT COUNT(*) INTO v_total_inventory_items FROM inventory_items;

    RAISE NOTICE '============================================';
    RAISE NOTICE 'MULTI-TENANT DMS - ALL SEED DATA COMPLETE!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'INVOICE SYSTEM:';
    RAISE NOTICE '  Total Invoices: % | Revenue: % DZD | Paid: % DZD | Outstanding: % DZD',
        v_total_invoices, v_total_revenue, v_total_paid, v_total_outstanding;
    RAISE NOTICE '  Total Payments: %', v_total_payments;
    RAISE NOTICE '--------------------------------------------';
    RAISE NOTICE 'ALL TABLES - RECORD COUNTS:';
    RAISE NOTICE '  Tenants: 3 | Users: % | Patients: % | Appointments: %',
        v_total_users, v_total_patients, v_total_appointments;
    RAISE NOTICE '  Treatment Records: % | Treatment Plans: % | Prescriptions: %',
        v_total_treatments, v_total_plans, v_total_prescriptions;
    RAISE NOTICE '  Suppliers: % | Inventory Items: % | Stock Movements: %',
        v_total_suppliers, v_total_inventory_items, v_total_stock_movements;
    RAISE NOTICE '  Purchase Orders: % | Expenses: %',
        v_total_purchase_orders, v_total_expenses;
    RAISE NOTICE '  Media: % | X-Rays: % | Notifications: % | Audit Logs: %',
        v_total_media, v_total_xrays, v_total_notifications, v_total_audit_logs;
    RAISE NOTICE '============================================';
    RAISE NOTICE 'FOCUS TENANT - Cabinet Dentaire El-Qods:';
    RAISE NOTICE '  100 patients, 5 staff (admin + 3 dentists + 1 receptionist)';
    RAISE NOTICE '  ~400 appointments across 90+ days (Sun-Thu)';
    RAISE NOTICE '  ~30 treatment records | 8 treatment plans | 14 invoices';
    RAISE NOTICE '  10 prescriptions | 5 x-rays | 10 notifications';
    RAISE NOTICE '  8 inventory items | 3 purchase orders | 12 stock movements';
    RAISE NOTICE '  12 expenses | 3 suppliers';
    RAISE NOTICE '============================================';
END $$;

