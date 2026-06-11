-- Migration 003: Remove tax-related columns
-- Drops tax_dzd from invoices and purchase_orders, tax_id from tenants and suppliers

ALTER TABLE invoices DROP COLUMN IF EXISTS tax_dzd;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS chk_invoice_tax;

ALTER TABLE purchase_orders DROP COLUMN IF EXISTS tax_dzd;
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS chk_po_tax;

ALTER TABLE tenants DROP COLUMN IF EXISTS tax_id;

ALTER TABLE suppliers DROP COLUMN IF EXISTS tax_id;

-- Create odontogram_conditions table for tooth-specific notes and conditions
CREATE TABLE IF NOT EXISTS odontogram_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    tooth_number VARCHAR(2) NOT NULL,
    condition VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(patient_id, tooth_number)
);

CREATE INDEX IF NOT EXISTS idx_odontogram_patient ON odontogram_conditions(tenant_id, patient_id);
