-- ============================================================================
-- ALGERIAN DENTAL MANAGEMENT SYSTEM (DMS) - POSTGRESQL SCHEMA
-- Database: PostgreSQL 14+
-- Currency: DZD (Algerian Dinar)
-- Localization: Translation Key Strategy
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. RBAC - ROLE MANAGEMENT
-- ============================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'System roles using translation keys (e.g., auth.role.admin)';
COMMENT ON COLUMN roles.role_key IS 'Unique translation key for frontend mapping';

CREATE INDEX idx_roles_key ON roles(role_key);

-- ============================================================================
-- 2. GEOGRAPHIC DATA - ALGERIA
-- ============================================================================

CREATE TABLE wilayas (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wilayas IS '58 Algerian provinces with translation keys';
COMMENT ON COLUMN wilayas.code IS 'Official wilaya code (01-58)';
COMMENT ON COLUMN wilayas.name_key IS 'Translation key (e.g., geo.wilaya.16)';

CREATE INDEX idx_wilayas_code ON wilayas(code);

-- ============================================================================
-- 3. USER MANAGEMENT
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+213[0-9]{9}$')
);

COMMENT ON TABLE users IS 'System users (Admins, Dentists, Receptionists)';
COMMENT ON COLUMN users.phone IS 'Algerian format: +213XXXXXXXXX';

CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================================================
-- 4. PATIENT MANAGEMENT
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_code VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(50) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_history TEXT,
    allergies TEXT,
    blood_type VARCHAR(5),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_patient_phone CHECK (phone ~ '^\+213[0-9]{9}$'),
    CONSTRAINT chk_patient_gender CHECK (gender IN ('patient.gender.male', 'patient.gender.female'))
);

COMMENT ON TABLE patients IS 'Patient records with user-generated names and addresses';
COMMENT ON COLUMN patients.patient_code IS 'Auto-generated unique identifier (e.g., PAT-2024-0001)';
COMMENT ON COLUMN patients.gender IS 'Translation key for gender';

CREATE INDEX idx_patients_code ON patients(patient_code);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_active ON patients(is_active);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);

-- ============================================================================
-- 5. TREATMENT CATEGORIES
-- ============================================================================

CREATE TABLE treatment_categories (
    id SERIAL PRIMARY KEY,
    category_key VARCHAR(100) NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES treatment_categories(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE treatment_categories IS 'Treatment classification using translation keys';
COMMENT ON COLUMN treatment_categories.category_key IS 'e.g., cat.surgery, cat.orthodontics';

CREATE INDEX idx_treatment_cat_key ON treatment_categories(category_key);
CREATE INDEX idx_treatment_cat_parent ON treatment_categories(parent_id);

-- ============================================================================
-- 6. APPOINTMENTS
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    status_key VARCHAR(50) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_appt_status CHECK (status_key IN (
        'appt.status.scheduled',
        'appt.status.confirmed',
        'appt.status.in_progress',
        'appt.status.completed',
        'appt.status.cancelled',
        'appt.status.no_show'
    )),
    CONSTRAINT chk_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

COMMENT ON TABLE appointments IS 'Patient appointments with status translation keys';

CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_dentist ON appointments(dentist_id);
CREATE INDEX idx_appt_date ON appointments(appointment_date);
CREATE INDEX idx_appt_status ON appointments(status_key);
CREATE INDEX idx_appt_dentist_date ON appointments(dentist_id, appointment_date);

-- ============================================================================
-- 7. TREATMENT RECORDS
-- ============================================================================

CREATE TABLE treatment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    dentist_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    category_id INTEGER REFERENCES treatment_categories(id) ON DELETE SET NULL,
    treatment_date TIMESTAMPTZ NOT NULL,
    tooth_number VARCHAR(10),
    diagnosis TEXT NOT NULL,
    treatment_performed TEXT NOT NULL,
    notes TEXT,
    estimated_cost_dzd DECIMAL(12, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_tooth_number CHECK (
        tooth_number ~ '^[0-9]{1,2}$' OR 
        tooth_number IN ('11', '12', '13', '14', '15', '16', '17', '18',
                         '21', '22', '23', '24', '25', '26', '27', '28',
                         '31', '32', '33', '34', '35', '36', '37', '38',
                         '41', '42', '43', '44', '45', '46', '47', '48')
    )
);

COMMENT ON TABLE treatment_records IS 'Clinical records with ISO tooth numbering system';
COMMENT ON COLUMN treatment_records.tooth_number IS 'FDI two-digit notation (11-48)';
COMMENT ON COLUMN treatment_records.estimated_cost_dzd IS 'Cost in Algerian Dinar';

CREATE INDEX idx_treatment_patient ON treatment_records(patient_id);
CREATE INDEX idx_treatment_dentist ON treatment_records(dentist_id);
CREATE INDEX idx_treatment_date ON treatment_records(treatment_date);
CREATE INDEX idx_treatment_appointment ON treatment_records(appointment_id);

-- ============================================================================
-- 8. PAYMENT METHODS
-- ============================================================================

CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    method_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_methods IS 'Payment methods with translation keys';
COMMENT ON COLUMN payment_methods.method_key IS 'e.g., pay.method.cash, pay.method.cib';

CREATE INDEX idx_payment_method_key ON payment_methods(method_key);

-- ============================================================================
-- 9. INVOICES
-- ============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(30) NOT NULL UNIQUE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    subtotal_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_dzd DECIMAL(12, 2) NOT NULL,
    paid_amount_dzd DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status_key VARCHAR(50) NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_invoice_payment_status CHECK (payment_status_key IN (
        'invoice.status.unpaid',
        'invoice.status.partial',
        'invoice.status.paid',
        'invoice.status.overdue',
        'invoice.status.cancelled'
    )),
    CONSTRAINT chk_invoice_amounts CHECK (
        subtotal_dzd >= 0 AND
        discount_dzd >= 0 AND
        tax_dzd >= 0 AND
        total_dzd >= 0 AND
        paid_amount_dzd >= 0 AND
        paid_amount_dzd <= total_dzd
    )
);

COMMENT ON TABLE invoices IS 'Patient invoices in Algerian Dinar (DZD)';

CREATE INDEX idx_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_patient ON invoices(patient_id);
CREATE INDEX idx_invoice_status ON invoices(payment_status_key);
CREATE INDEX idx_invoice_date ON invoices(issue_date);

-- ============================================================================
-- 10. INVOICE ITEMS
-- ============================================================================

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    treatment_record_id UUID REFERENCES treatment_records(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_dzd DECIMAL(12, 2) NOT NULL,
    total_price_dzd DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_item_prices CHECK (
        unit_price_dzd >= 0 AND
        total_price_dzd >= 0 AND
        total_price_dzd = (quantity * unit_price_dzd)
    )
);

COMMENT ON TABLE invoice_items IS 'Line items for each invoice';

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_treatment ON invoice_items(treatment_record_id);

-- ============================================================================
-- 11. PAYMENTS
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount_dzd DECIMAL(12, 2) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_reference VARCHAR(100),
    notes TEXT,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_payment_amount CHECK (amount_dzd > 0)
);

COMMENT ON TABLE payments IS 'Payment transactions in DZD';

CREATE INDEX idx_payment_invoice ON payments(invoice_id);
CREATE INDEX idx_payment_method ON payments(payment_method_id);
CREATE INDEX idx_payment_date ON payments(payment_date);

-- ============================================================================
-- 12. AUDIT LOG
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'System-wide audit trail';

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_treatment_cat_updated_at BEFORE UPDATE ON treatment_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_treatment_records_updated_at BEFORE UPDATE ON treatment_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

CREATE OR REPLACE VIEW v_patient_summary AS
SELECT 
    p.id,
    p.patient_code,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    w.name_key AS wilaya_name_key,
    COUNT(DISTINCT a.id) AS total_appointments,
    COUNT(DISTINCT tr.id) AS total_treatments,
    COALESCE(SUM(i.total_dzd), 0) AS total_billed_dzd,
    COALESCE(SUM(i.paid_amount_dzd), 0) AS total_paid_dzd,
    MAX(a.appointment_date) AS last_appointment_date
FROM patients p
LEFT JOIN wilayas w ON p.wilaya_id = w.id
LEFT JOIN appointments a ON p.id = a.patient_id
LEFT JOIN treatment_records tr ON p.id = tr.patient_id
LEFT JOIN invoices i ON p.id = i.patient_id
GROUP BY p.id, p.patient_code, p.first_name, p.last_name, 
         p.phone, p.email, w.name_key;

CREATE OR REPLACE VIEW v_outstanding_invoices AS
SELECT 
    i.id,
    i.invoice_number,
    p.patient_code,
    p.first_name || ' ' || p.last_name AS patient_name,
    i.total_dzd,
    i.paid_amount_dzd,
    (i.total_dzd - i.paid_amount_dzd) AS balance_dzd,
    i.issue_date,
    i.due_date,
    i.payment_status_key
FROM invoices i
JOIN patients p ON i.patient_id = p.id
WHERE i.payment_status_key IN ('invoice.status.unpaid', 'invoice.status.partial', 'invoice.status.overdue')
ORDER BY i.due_date ASC NULLS LAST;