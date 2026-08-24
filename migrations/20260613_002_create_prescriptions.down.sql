-- SAFE ROLLBACK: The `prescriptions` table is now owned by the db.sql baseline
-- (schema source of truth, applied fresh by recreate-db.* and CI). Dropping it
-- here would destroy live data on any current install, so the table itself is
-- intentionally NOT dropped.
-- This rollback only removes objects created exclusively by this migration and
-- not present in db.sql: the RX auto-numbering trigger and its helper functions.
DROP TRIGGER IF EXISTS trg_set_prescription_number ON prescriptions;
DROP FUNCTION IF EXISTS set_prescription_number();
DROP FUNCTION IF EXISTS generate_prescription_number(UUID);
