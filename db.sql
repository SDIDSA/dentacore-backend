-- ============================================================================
-- ALGERIAN DENTAL MANAGEMENT SYSTEM (DMS) - MULTI-TENANT SAAS
-- Database: PostgreSQL 14+
-- Architecture: Single Database, Shared Schema, Discriminator Column
-- Currency: DZD (Algerian Dinar)
-- Localization: Translation Key Strategy
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS (Multi-Tenant Core)
-- ============================================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    tax_id VARCHAR(50), -- NIF/NIS for Algerian businesses
    logo_url TEXT,
    primary_color VARCHAR(7), -- Hex color code
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'tenant.status.trial',
    subscription_plan VARCHAR(50),
    subscription_started_at TIMESTAMP,
    subscription_ends_at TIMESTAMP,
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_subdomain_format CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
    CONSTRAINT chk_subscription_status CHECK (subscription_status IN (
        'tenant.status.trial',
        'tenant.status.active',
        'tenant.status.suspended',
        'tenant.status.cancelled',
        'tenant.status.expired'
    )),
    CONSTRAINT chk_primary_color CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$' OR primary_color IS NULL)
);

COMMENT ON TABLE tenants IS 'Dental clinic tenants - each represents an independent practice';
COMMENT ON COLUMN tenants.subdomain IS 'Unique subdomain for clinic access (e.g., clinic.dms.dz)';
COMMENT ON COLUMN tenants.tax_id IS 'Algerian Tax ID (NIF/NIS)';
COMMENT ON COLUMN tenants.settings IS 'JSONB for branding, features, and custom configurations';

CREATE INDEX idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX idx_tenants_status ON tenants(subscription_status);
CREATE INDEX idx_tenants_active ON tenants(is_active);

-- ============================================================================
-- 2. RBAC - ROLE MANAGEMENT (Global)
-- ============================================================================

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    role_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'System roles using translation keys (e.g., auth.role.admin)';
COMMENT ON COLUMN roles.role_key IS 'Unique translation key for frontend mapping';

CREATE INDEX idx_roles_key ON roles(role_key);

-- ============================================================================
-- 3. GEOGRAPHIC DATA - ALGERIA (Global)
-- ============================================================================

CREATE TABLE wilayas (
    id SMALLINT PRIMARY KEY,
    code VARCHAR(2) NOT NULL UNIQUE,
    name_key VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wilayas IS '58 Algerian provinces with translation keys';
COMMENT ON COLUMN wilayas.code IS 'Official wilaya code (01-58)';
COMMENT ON COLUMN wilayas.name_key IS 'Translation key (e.g., geo.wilaya.16)';

CREATE INDEX idx_wilayas_code ON wilayas(code);

-- ============================================================================
-- 4. PAYMENT METHODS (Global)
-- ============================================================================

CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    method_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE payment_methods IS 'Available payment methods in Algeria';

CREATE INDEX idx_payment_methods_key ON payment_methods(method_key);
CREATE INDEX idx_payment_methods_active ON payment_methods(is_active);

-- ============================================================================
-- 5. USER MANAGEMENT (Tenant-Scoped)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    wilaya_id SMALLINT REFERENCES wilayas(id) ON DELETE SET NULL,
    address TEXT,
    status_key VARCHAR(50) NOT NULL DEFAULT 'user.status.active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+213[0-9]{9}$'),
    CONSTRAINT chk_user_status CHECK (status_key IN ('user.status.active', 'user.status.inactive', 'user.status.deleted'))
);

COMMENT ON TABLE users IS 'Tenant-scoped users (Admins, Dentists, Receptionists)';
COMMENT ON COLUMN users.tenant_id IS 'Isolates users per tenant';
COMMENT ON COLUMN users.phone IS 'Algerian format: +213XXXXXXXXX';

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_email ON users(tenant_id, email);
CREATE INDEX idx_users_status ON users(tenant_id, status_key);



-- ============================================================================
-- 6. PATIENT MANAGEMENT (Tenant-Scoped)
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_code VARCHAR(20) NOT NULL,
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
    CONSTRAINT chk_patient_status CHECK (status_key IN ('user.status.active', 'user.status.inactive', 'user.status.deleted')),
    CONSTRAINT uq_patients_tenant_code UNIQUE (tenant_id, patient_code),
    CONSTRAINT uq_patients_tenant_phone UNIQUE (tenant_id, phone)
);

COMMENT ON TABLE patients IS 'Tenant-scoped patient records';
COMMENT ON COLUMN patients.tenant_id IS 'Isolates patients per tenant';
COMMENT ON COLUMN patients.patient_code IS 'Auto-generated, tenant-scoped (e.g., PAT-2024-0001)';

CREATE INDEX idx_patients_tenant ON patients(tenant_id);
CREATE INDEX idx_patients_code ON patients(tenant_id, patient_code);
CREATE INDEX idx_patients_name ON patients(tenant_id, last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(tenant_id, phone);
CREATE INDEX idx_patients_status ON patients(tenant_id, status_key);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);



-- ============================================================================
-- 7. TREATMENT CATEGORIES (Hybrid: Global + Tenant-Specific)
-- ============================================================================

CREATE TABLE treatment_categories (
    id SERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_key VARCHAR(100) NOT NULL,
    parent_id INTEGER REFERENCES treatment_categories(id) ON DELETE CASCADE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_treatment_cat_key UNIQUE (tenant_id, category_key)
);

COMMENT ON TABLE treatment_categories IS 'Hybrid: NULL tenant_id = Global defaults, SET tenant_id = Custom categories';
COMMENT ON COLUMN treatment_categories.tenant_id IS 'NULL for system defaults, UUID for tenant-specific';

CREATE INDEX idx_treatment_cat_tenant ON treatment_categories(tenant_id);
CREATE INDEX idx_treatment_cat_key ON treatment_categories(tenant_id, category_key);
CREATE INDEX idx_treatment_cat_parent ON treatment_categories(parent_id);
CREATE INDEX idx_treatment_cat_global ON treatment_categories(tenant_id) WHERE tenant_id IS NULL;

-- ============================================================================
-- 8. APPOINTMENTS (Tenant-Scoped)
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
    
    CONSTRAINT chk_appt_status CHECK (status_key IN (
        'appt.status.scheduled',
        'appt.status.confirmed',
        'appt.status.completed',
        'appt.status.cancelled',
        'appt.status.no_show'
    )),
    CONSTRAINT chk_duration CHECK (duration_minutes > 0 AND duration_minutes <= 480)
);

COMMENT ON TABLE appointments IS 'Tenant-scoped patient appointments';

CREATE INDEX idx_appt_tenant ON appointments(tenant_id);
CREATE INDEX idx_appt_patient ON appointments(tenant_id, patient_id);
CREATE INDEX idx_appt_dentist ON appointments(tenant_id, dentist_id);
CREATE INDEX idx_appt_date ON appointments(tenant_id, appointment_date);
CREATE INDEX idx_appt_status ON appointments(tenant_id, status_key);
CREATE INDEX idx_appt_dentist_date ON appointments(tenant_id, dentist_id, appointment_date);



-- ============================================================================
-- 9. TREATMENT RECORDS (Tenant-Scoped)
-- ============================================================================

CREATE TABLE treatment_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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
    
    CONSTRAINT chk_tooth_number CHECK (
        tooth_number ~ '^[0-9]{1,2}$' OR 
        tooth_number IN ('11', '12', '13', '14', '15', '16', '17', '18',
                         '21', '22', '23', '24', '25', '26', '27', '28',
                         '31', '32', '33', '34', '35', '36', '37', '38',
                         '41', '42', '43', '44', '45', '46', '47', '48')
    ),
    CONSTRAINT chk_treatment_cost CHECK (estimated_cost_dzd >= 0)
);

COMMENT ON TABLE treatment_records IS 'Tenant-scoped clinical treatment records';

CREATE INDEX idx_treatment_tenant ON treatment_records(tenant_id);
CREATE INDEX idx_treatment_patient ON treatment_records(tenant_id, patient_id);
CREATE INDEX idx_treatment_dentist ON treatment_records(tenant_id, dentist_id);
CREATE INDEX idx_treatment_date ON treatment_records(tenant_id, treatment_date);
CREATE INDEX idx_treatment_category ON treatment_records(category_id);



-- ============================================================================
-- 10. INVOICES (Tenant-Scoped)
-- ============================================================================

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number VARCHAR(30) NOT NULL,
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
    ),
    CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number)
);

COMMENT ON TABLE invoices IS 'Tenant-scoped patient invoices in DZD';

CREATE INDEX idx_invoice_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoice_number ON invoices(tenant_id, invoice_number);
CREATE INDEX idx_invoice_patient ON invoices(tenant_id, patient_id);
CREATE INDEX idx_invoice_status ON invoices(tenant_id, payment_status_key);
CREATE INDEX idx_invoice_date ON invoices(tenant_id, issue_date);



-- ============================================================================
-- 11. INVOICE ITEMS (Tenant-Scoped)
-- ============================================================================

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    treatment_record_id UUID REFERENCES treatment_records(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_dzd DECIMAL(12, 2) NOT NULL,
    total_price_dzd DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_item_prices CHECK (
        unit_price_dzd >= 0 AND
        total_price_dzd >= 0 AND
        total_price_dzd = (quantity * unit_price_dzd)
    )
);

COMMENT ON TABLE invoice_items IS 'Tenant-scoped line items for invoices';

CREATE INDEX idx_invoice_items_tenant ON invoice_items(tenant_id);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(tenant_id, invoice_id);
CREATE INDEX idx_invoice_items_treatment ON invoice_items(treatment_record_id);



-- ============================================================================
-- 12. PAYMENTS (Tenant-Scoped)
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    payment_method_id INTEGER NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    amount_dzd DECIMAL(12, 2) NOT NULL,
    payment_date TIMESTAMP NOT NULL DEFAULT NOW(),
    transaction_reference VARCHAR(100),
    notes TEXT,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_payment_amount CHECK (amount_dzd > 0)
);

COMMENT ON TABLE payments IS 'Tenant-scoped payment transactions in DZD';

CREATE INDEX idx_payment_tenant ON payments(tenant_id);
CREATE INDEX idx_payment_invoice ON payments(tenant_id, invoice_id);
CREATE INDEX idx_payment_method ON payments(payment_method_id);
CREATE INDEX idx_payment_date ON payments(tenant_id, payment_date);



-- ============================================================================
-- 13. AUDIT LOG (Tenant-Scoped)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
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

COMMENT ON TABLE audit_logs IS 'Tenant-scoped audit trail';

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(tenant_id, created_at);



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

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
-- AUTO-GENERATION FUNCTIONS (Tenant-Scoped)
-- ============================================================================

-- Function to generate patient codes (tenant-scoped)
CREATE OR REPLACE FUNCTION generate_patient_code(p_tenant_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    new_code VARCHAR(20);
    year_str VARCHAR(4);
    sequence_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    -- Get the next sequence number for this tenant and year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(patient_code FROM 10) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM patients
    WHERE tenant_id = p_tenant_id
      AND patient_code LIKE 'PAT-' || year_str || '-%';
    
    new_code := 'PAT-' || year_str || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to generate invoice numbers (tenant-scoped)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_tenant_id UUID)
RETURNS VARCHAR(30) AS $$
DECLARE
    new_number VARCHAR(30);
    year_str VARCHAR(4);
    month_str VARCHAR(2);
    sequence_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    month_str := TO_CHAR(CURRENT_DATE, 'MM');
    
    -- Get the next sequence number for this tenant and month
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(invoice_number FROM 13) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE tenant_id = p_tenant_id
      AND invoice_number LIKE 'INV-' || year_str || month_str || '-%';
    
    new_number := 'INV-' || year_str || month_str || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate patient code (tenant-aware)
CREATE OR REPLACE FUNCTION set_patient_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.patient_code IS NULL OR NEW.patient_code = '' THEN
        NEW.patient_code := generate_patient_code(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_patient_code
    BEFORE INSERT ON patients
    FOR EACH ROW
    EXECUTE FUNCTION set_patient_code();

-- Trigger to auto-generate invoice number (tenant-aware)
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();



-- ============================================================================
-- VIEWS FOR COMMON QUERIES (Tenant-Aware)
-- ============================================================================

CREATE OR REPLACE VIEW v_patient_summary AS
SELECT 
    p.tenant_id,
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
LEFT JOIN appointments a ON p.id = a.patient_id AND p.tenant_id = a.tenant_id
LEFT JOIN treatment_records tr ON p.id = tr.patient_id AND p.tenant_id = tr.tenant_id
LEFT JOIN invoices i ON p.id = i.patient_id AND p.tenant_id = i.tenant_id
GROUP BY p.tenant_id, p.id, p.patient_code, p.first_name, p.last_name,  
         p.phone, p.email, w.name_key;

CREATE OR REPLACE VIEW v_outstanding_invoices AS
SELECT 
    i.tenant_id,
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
JOIN patients p ON i.patient_id = p.id AND i.tenant_id = p.tenant_id
WHERE i.payment_status_key IN ('invoice.status.unpaid', 'invoice.status.partial', 'invoice.status.overdue')
ORDER BY i.due_date ASC NULLS LAST;

-- ============================================================================
-- HELPER FUNCTION: Get Treatment Categories (Global + Tenant-Specific)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_treatment_categories(p_tenant_id UUID)
RETURNS TABLE (
    id INTEGER,
    category_key VARCHAR(100),
    parent_id INTEGER,
    description TEXT,
    is_global BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tc.id,
        tc.category_key,
        tc.parent_id,
        tc.description,
        (tc.tenant_id IS NULL) AS is_global
    FROM treatment_categories tc
    WHERE tc.tenant_id IS NULL -- Global defaults
       OR tc.tenant_id = p_tenant_id -- Tenant-specific
    ORDER BY tc.category_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION: Auth Helper Function
-- ============================================================================

\echo 'Creating get_user_by_email function...'
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE (
    id UUID,
    email VARCHAR,
    password_hash VARCHAR,
    full_name VARCHAR,
    status_key VARCHAR,
    last_login_at TIMESTAMP,
    tenant_id UUID,
    role_key VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.email,
        u.password_hash,
        u.full_name,
        u.status_key,
        u.last_login_at,
        u.tenant_id,
        r.role_key
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Multi-Tenant Dental Management System';
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Architecture: Single Database, Shared Schema';
    RAISE NOTICE 'Isolation: tenant_id discriminator + RLS';
    RAISE NOTICE 'Global Tables: roles, wilayas, payment_methods';
    RAISE NOTICE 'Tenant Tables: users, patients, appointments, etc.';
    RAISE NOTICE 'Hybrid Tables: treatment_categories';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Next Step: Run seed_multitenant.sql';
    RAISE NOTICE '============================================';
END $$;
