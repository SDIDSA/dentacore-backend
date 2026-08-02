CREATE OR REPLACE FUNCTION generate_prescription_number(p_tenant_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
    year_str VARCHAR(4);
    month_str VARCHAR(2);
    sequence_num INTEGER;
BEGIN
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    month_str := TO_CHAR(CURRENT_DATE, 'MM');

    SELECT COALESCE(MAX(
        CAST(SUBSTRING(prescription_number FROM 11) AS INTEGER)
    ), 0) + 1
    INTO sequence_num
    FROM prescriptions
    WHERE tenant_id = p_tenant_id
      AND prescription_number LIKE 'RX-' || year_str || month_str || '-%';

    new_number := 'RX-' || year_str || month_str || '-' || LPAD(sequence_num::TEXT, 4, '0');

    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_prescription_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.prescription_number IS NULL OR NEW.prescription_number = '' THEN
        NEW.prescription_number := generate_prescription_number(NEW.tenant_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_set_prescription_number'
    ) THEN
        CREATE TRIGGER trg_set_prescription_number
            BEFORE INSERT ON prescriptions
            FOR EACH ROW
            EXECUTE FUNCTION set_prescription_number();
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dentist_id UUID REFERENCES users(id) ON DELETE SET NULL,
    prescription_number VARCHAR(20) NOT NULL,
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    duration VARCHAR(100),
    notes TEXT,
    status_key VARCHAR(50) NOT NULL DEFAULT 'prescription.status.active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_prescription_status CHECK (status_key IN (
        'prescription.status.active', 'prescription.status.completed', 'prescription.status.cancelled'
    ))
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_tenant ON prescriptions(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(tenant_id, patient_id, status_key);
