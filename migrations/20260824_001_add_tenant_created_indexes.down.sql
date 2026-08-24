-- Revert: drop the tenant/created-at list-sort indexes added in the up migration.

DROP INDEX IF EXISTS idx_notifications_tenant_created;
DROP INDEX IF EXISTS idx_treatment_plans_tenant_created;
DROP INDEX IF EXISTS idx_media_tenant_created;
DROP INDEX IF EXISTS idx_suppliers_tenant_created;
DROP INDEX IF EXISTS idx_inventory_items_tenant_created;
DROP INDEX IF EXISTS idx_users_tenant_created;
DROP INDEX IF EXISTS idx_patients_tenant_created;
