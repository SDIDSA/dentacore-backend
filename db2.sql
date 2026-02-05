-- ============================================================================
-- ALGERIAN DENTAL MANAGEMENT SYSTEM (DMS) - MULTI-CLINIC EDITION
-- Database: PostgreSQL 14+
-- Architecture: Multi-Tenant (Shared Schema, Discriminator Column)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. GLOBAL REFERENCE DATA (Shared across all clinics)
-- ============================================================================

-- 1.1 Geographic Data
CREATE TABLE wilayas (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
-- (Indexes and comments same as before)
CREATE INDEX idx_wilayas_code ON wilayas(code);

-- 1.2 Roles
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_roles_key ON roles(role_key);

-- 1.3 Payment Methods (Global Definitions)
CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    method_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_method_key ON payment_methods(method_key);

-- ============================================================================
-- 2. CLINIC MANAGEMENT (The Tenant)
-- ============================================================================

CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(50) UNIQUE, -- Useful for subdomains (e.g., clinic-a.dms.dz)
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    logo_url TEXT,
    website VARCHAR(255),
    
    -- Clinic specific settings (Working hours, default tax rate, printer headers)
    settings JSONB DEFAULT '{}'::jsonb,
    
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_clinic_phone CHECK (phone ~ '^\+213[0-9]{9}$')
);

COMMENT ON TABLE clinics IS 'Tenant table: Represents distinct dental practices or branches';

-- ============================================================================
-- 3. USER MANAGEMENT (Scoped to Clinic)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE, -- NULL indicates Super Admin
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    
    email VARCHAR(255) NOT NULL UNIQUE, -- Emails usually remain globally unique for login
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    status_key VARCHAR(50) NOT NULL DEFAULT 'user.status.active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_user_phone CHECK (phone ~ '^\+213[0-9]{9}$'),
    CONSTRAINT chk_user_status CHECK (status_key IN ('user.status.active', 'user.status.inactive', 'user.status.deleted'))
);

CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================================
-- 4. TREATMENT CATEGORIES (Hybrid: Global + Clinic Specific)
-- ============================================================================

CREATE TABLE treatment_categories (
    id SERIAL PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE, -- If NULL, it is a System Default category
    category_key VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES treatment_categories(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Ensure category keys are unique within a clinic (or unique within global defaults)
    CONSTRAINT uq_category_per_clinic UNIQUE NULLS NOT DISTINCT (clinic_id, category_key)
);

CREATE INDEX idx_treatment_cat_clinic ON treatment_categories(clinic_id);

-- ============================================================================
-- 5. PATIENT MANAGEMENT
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, -- Mandatory: Patient belongs to a clinic
    
    patient_code VARCHAR(20) NOT NULL, -- Not globally unique anymore
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    blood_type VARCHAR(5),
    status_key VARCHAR(50) NOT NULL DEFAULT 'user.status.active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_patient_phone CHECK (phone ~ '^\+213[0-9]{9}$'),
    CONSTRAINT chk_patient_gender CHECK (gender IN ('patient.gender.male', 'patient.gender.female')),
    
    -- IMPORTANT: Constraints are now composite (Scoped to Clinic)
    CONSTRAINT uq_patient_code_clinic UNIQUE (clinic_id, patient_code),
    CONSTRAINT uq_patient_phone_clinic UNIQUE (clinic_id, phone) -- Same patient can exist in different clinics
);

CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_code ON patients(patient_code);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);

-- ============================================================================
-- 6. APPOINTMENTS
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, -- Denormalized for RLS/Performance
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    appointment_date TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status_key VARCHAR(50) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_appt_status CHECK (status_key IN ('appt.status.scheduled', 'appt.status.confirmed', 'appt.status.completed', 'appt.status.cancelled', 'appt.status.no_show')),
    CONSTRAINT chk_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

CREATE INDEX idx_appt_clinic ON appointments(clinic_id);
CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_dentist_date ON appointments(dentist_id, appointment_date);

-- ============================================================================
-- 7. TREATMENT RECORDS
-- ============================================================================

CREATE TABLE treatment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id INTEGER REFERENCES treatment_categories(id) ON DELETE SET NULL,
    
    treatment_date TIMESTAMP NOT NULL,
    tooth_number VARCHAR(10),
    diagnosis TEXT NOT NULL,
    treatment_performed TEXT NOT NULL,
    notes TEXT,
    estimated_cost_dzd DECIMAL(12, 2),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_tooth_number CHECK (tooth_number ~ '^[0-9]{1,2}$' OR tooth_number IN ('11', '12', '13', '14', '15', '16', '17', '18', '21', '22', '23', '24', '25', '26', '27', '28', '31', '32', '33', '34', '35', '36', '37', '38', '41', '42', '43', '44', '45', '46', '47', '48'))
);

CREATE INDEX idx_treatment_clinic ON treatment_records(clinic_id);
CREATE INDEX idx_treatment_patient ON treatment_records(patient_id);

-- ============================================================================
-- 8. INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    
    invoice_number VARCHAR(30) NOT NULL, -- Unique per clinic only
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    issue_date TIMESTAMP NOT NULL DEFAULT NOW(),
    due_date TIMESTAMP,
    subtotal_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_dzd DECIMAL(12, 2) NOT NULL,
    paid_amount_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status_key VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_invoice_number_clinic UNIQUE (clinic_id, invoice_number), -- Scope uniqueness
    CONSTRAINT chk_invoice_payment_status CHECK (payment_status_key IN ('invoice.status.unpaid', 'invoice.status.partial', 'invoice.status.paid', 'invoice.status.overdue', 'invoice.status.cancelled'))
);

CREATE INDEX idx_invoice_clinic ON invoices(clinic_id);
CREATE INDEX idx_invoice_patient ON invoices(patient_id);
CREATE INDEX idx_invoice_number ON invoices(invoice_number);

-- ============================================================================
-- 9. INVOICE ITEMS (Child of Invoice, implicitly linked to Clinic)
-- ============================================================================

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    treatment_record_id UUID REFERENCES treatment_records(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_dzd DECIMAL(12, 2) NOT NULL,
    total_price_dzd DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ============================================================================
-- 10. PAYMENTS
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, -- Useful for financial reporting per clinic
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    
    amount_dzd DECIMAL(12, 2) NOT NULL,
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    transaction_reference VARCHAR(100),
    notes TEXT,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_clinic ON payments(clinic_id);
CREATE INDEX idx_payment_invoice ON payments(invoice_id);

-- ============================================================================
-- 11. AUDIT LOG (Updated)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE, -- Track which clinic this event happened in
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_clinic ON audit_logs(clinic_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);

-- ============================================================================
-- TRIGGERS (Re-applied to new schema)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to all tables with updated_at
CREATE TRIGGER trg_clinics_updated_at BEFORE UPDATE ON clinics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_treatment_cat_updated_at BEFORE UPDATE ON treatment_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_treatment_records_updated_at BEFORE UPDATE ON treatment_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- UPDATED VIEWS (Now Clinic Aware)
-- ============================================================================

-- View: Patient Summary (Includes Clinic ID for filtering)
CREATE OR REPLACE VIEW v_patient_summary AS
SELECT 
    p.clinic_id, -- Added for filtering
    c.name AS clinic_name,
    p.id AS patient_id,
    p.patient_code,
    p.first_name,
    p.last_name,
    p.phone,
    w.name_key AS wilaya_name_key,
    COUNT(DISTINCT a.id) AS total_appointments,
    COALESCE(SUM(i.total_dzd), 0) AS total_billed_dzd,
    COALESCE(SUM(i.paid_amount_dzd), 0) AS total_paid_dzd,
    MAX(a.appointment_date) AS last_appointment_date
FROM patients p
JOIN clinics c ON p.clinic_id = c.id
LEFT JOIN wilayas w ON p.wilaya_id = w.id
LEFT JOIN appointments a ON p.id = a.patient_id
LEFT JOIN invoices i ON p.id = i.patient_id
GROUP BY p.clinic_id, c.name, p.id, p.patient_code, p.first_name, p.last_name, 
         p.phone, w.name_key;