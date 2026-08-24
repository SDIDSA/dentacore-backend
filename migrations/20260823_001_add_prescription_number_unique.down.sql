-- Drop the per-tenant unique constraint on prescription_number added by the matching up migration.
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS uq_prescriptions_tenant_number;
