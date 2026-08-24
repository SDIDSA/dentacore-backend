-- Enforce unique prescription numbers per tenant.
-- Guarded so it is a no-op when the constraint already exists (e.g. re-run
-- after a db.sql baseline that already carries the constraint).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_prescriptions_tenant_number'
          AND conrelid = 'prescriptions'::regclass
    ) THEN
        ALTER TABLE prescriptions
            ADD CONSTRAINT uq_prescriptions_tenant_number UNIQUE (tenant_id, prescription_number);
    END IF;
END $$;
