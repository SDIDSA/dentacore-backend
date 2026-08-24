-- Add (tenant_id, created_at DESC) indexes for default list sorts.
-- Every entity list endpoint filters WHERE tenant_id = ? ORDER BY created_at DESC;
-- only audit_logs and notifications had a supporting composite index.

CREATE INDEX IF NOT EXISTS idx_patients_tenant_created
    ON patients(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_tenant_created
    ON users(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_created
    ON inventory_items(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_created
    ON suppliers(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_tenant_created
    ON media(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_tenant_created
    ON treatment_plans(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created
    ON notifications(tenant_id, created_at DESC);
