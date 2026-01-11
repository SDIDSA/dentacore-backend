-- ============================================================================
-- SEED DATA FOR ALGERIAN DENTAL MANAGEMENT SYSTEM
-- ============================================================================

-- ============================================================================
-- 1. SYSTEM ROLES
-- ============================================================================

INSERT INTO roles (role_key, description) VALUES
('auth.role.admin', 'System Administrator with full access'),
('auth.role.dentist', 'Licensed dentist with clinical access'),
('auth.role.receptionist', 'Front desk staff for appointments and billing');

-- ============================================================================
-- 2. ALGERIAN WILAYAS (58 Provinces)
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
-- 3. PAYMENT METHODS (ALGERIA)
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
-- 4. TREATMENT CATEGORIES (Sample)
-- ============================================================================

INSERT INTO treatment_categories (category_key, parent_id, description, is_active) VALUES
-- Root Categories
('cat.preventive', NULL, 'Preventive dental care', TRUE),
('cat.restorative', NULL, 'Restorative procedures', TRUE),
('cat.surgery', NULL, 'Oral and maxillofacial surgery', TRUE),
('cat.orthodontics', NULL, 'Orthodontic treatments', TRUE),
('cat.endodontics', NULL, 'Root canal treatments', TRUE),
('cat.periodontics', NULL, 'Gum disease treatments', TRUE),
('cat.prosthodontics', NULL, 'Dental prosthetics', TRUE),
('cat.cosmetic', NULL, 'Cosmetic dentistry', TRUE);

-- Sub-categories (examples)
INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.preventive.cleaning', id, 'Professional teeth cleaning', TRUE
FROM treatment_categories WHERE category_key = 'cat.preventive';

INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.preventive.fluoride', id, 'Fluoride treatment', TRUE
FROM treatment_categories WHERE category_key = 'cat.preventive';

INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.restorative.filling', id, 'Dental fillings', TRUE
FROM treatment_categories WHERE category_key = 'cat.restorative';

INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.restorative.crown', id, 'Dental crowns', TRUE
FROM treatment_categories WHERE category_key = 'cat.restorative';

INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.surgery.extraction', id, 'Tooth extraction', TRUE
FROM treatment_categories WHERE category_key = 'cat.surgery';

INSERT INTO treatment_categories (category_key, parent_id, description, is_active)
SELECT 'cat.surgery.implant', id, 'Dental implant placement', TRUE
FROM treatment_categories WHERE category_key = 'cat.surgery';

-- ============================================================================
-- 5. SAMPLE ADMIN USER (Password: Admin@123456)
-- ============================================================================
-- Note: In production, use a secure password hashing library
-- This example uses pgcrypto's crypt() function

INSERT INTO users (
    role_id, 
    email, 
    password_hash, 
    full_name, 
    phone, 
    wilaya_id, 
    is_active
)
SELECT 
    r.id,
    'admin@dental-clinic.dz',
    crypt('Admin@123456', gen_salt('bf')),
    'System Administrator',
    '+213555000000',
    16, -- Algiers
    TRUE
FROM roles r
WHERE r.role_key = 'auth.role.admin';

INSERT INTO users (
    role_id,
    email,
    password_hash,
    full_name,
    phone,
    wilaya_id,
    is_active
)
SELECT
    r.id,
    'zinou.teyar@gmail.com',
    crypt('A1b2-A1b2', gen_salt('bf')),
    'Zinelabidine Teyar',
    '+213549468120',
    25, -- Algiers
    TRUE
FROM roles r
WHERE r.role_key = 'auth.role.dentist';

-- ============================================================================
-- 7. SAMPLE AUDIT LOGS (Recent Activity Examples)
-- ============================================================================

-- Get the admin user ID for audit logs
DO $
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@dental-clinic.dz';
    
    -- Sample audit logs from the past week
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent, created_at) VALUES
    (admin_user_id, 'LOGIN', 'users', admin_user_id, '{"email": "admin@dental-clinic.dz"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '2 hours'),
    (admin_user_id, 'CREATE', 'patients', uuid_generate_v4(), '{"patient_code": "PAT-2024-0001", "first_name": "Ahmed", "last_name": "Benali"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '1 day'),
    (admin_user_id, 'UPDATE', 'appointments', uuid_generate_v4(), '{"status_key": "appt.status.completed"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '3 hours'),
    (admin_user_id, 'CREATE', 'invoices', uuid_generate_v4(), '{"invoice_number": "INV-202401-0001", "total_dzd": 15000}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '5 hours'),
    (admin_user_id, 'CREATE', 'payments', uuid_generate_v4(), '{"amount_dzd": 15000, "method": "pay.method.cash"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '4 hours'),
    (admin_user_id, 'UPDATE', 'patients', uuid_generate_v4(), '{"phone": "+213555123456"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '6 hours'),
    (admin_user_id, 'CREATE', 'treatment_records', uuid_generate_v4(), '{"diagnosis": "Dental caries", "tooth_number": "16"}', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', NOW() - INTERVAL '1 day 2 hours');
END $;

-- ============================================================================
-- 9. SAMPLE DATA VERIFICATION QUERIES
-- ============================================================================

-- Verify roles
-- SELECT * FROM roles;

-- Verify wilayas count (should be 58)
-- SELECT COUNT(*) FROM wilayas;

-- Verify payment methods
-- SELECT * FROM payment_methods WHERE is_active = TRUE;

-- Verify treatment categories
-- SELECT 
--     c.category_key,
--     p.category_key AS parent_key,
--     c.description
-- FROM treatment_categories c
-- LEFT JOIN treatment_categories p ON c.parent_id = p.id
-- ORDER BY p.category_key NULLS FIRST, c.category_key;

-- ============================================================================
-- 7. ADDITIONAL HELPER FUNCTIONS
-- ============================================================================

-- Function to generate patient codes
CREATE OR REPLACE FUNCTION generate_patient_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    year_str VARCHAR(4);
    sequence_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get the next sequence number for this year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(patient_code FROM 10) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM patients
    WHERE patient_code LIKE 'PAT-' || year_str || '-%';
    
    new_code := 'PAT-' || year_str || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(30) AS $$
DECLARE
    new_number VARCHAR(30);
    year_str VARCHAR(4);
    month_str VARCHAR(2);
    sequence_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    month_str := TO_CHAR(CURRENT_DATE, 'MM');
    
    -- Get the next sequence number for this month
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 13) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_str || month_str || '-%';
    
    new_number := 'INV-' || year_str || month_str || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate patient code
CREATE OR REPLACE FUNCTION set_patient_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
        NEW.patient_code := generate_patient_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_patient_code
    BEFORE INSERT ON patients
    FOR EACH ROW
    EXECUTE FUNCTION set_patient_code();

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Algerian Dental Management System';
    RAISE NOTICE 'Seed data loaded successfully!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Roles: 3 (Admin, Dentist, Receptionist)';
    RAISE NOTICE 'Wilayas: 58 (All Algerian provinces)';
    RAISE NOTICE 'Payment Methods: 7 (Algerian standards)';
    RAISE NOTICE 'Treatment Categories: 14 (Base + subcategories)';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Default Admin Credentials:';
    RAISE NOTICE 'Email: admin@dental-clinic.dz';
    RAISE NOTICE 'Password: Admin@123456';
    RAISE NOTICE '*** CHANGE THIS PASSWORD IMMEDIATELY! ***';
    RAISE NOTICE '============================================';
END $$;