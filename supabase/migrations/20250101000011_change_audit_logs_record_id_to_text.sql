-- Change audit_logs record_id from UUID to TEXT
-- This migration changes the audit_logs table record_id column type from UUID to TEXT
-- to match the TEXT IDs used in most tables

-- First, drop the audit_logs_view that depends on the audit_logs table
DROP VIEW IF EXISTS audit_logs_view;

-- Change the record_id column type from UUID to TEXT
ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT;

-- Add comment to explain the change
COMMENT ON COLUMN audit_logs.record_id IS 'Record ID from the audited table (TEXT type to support both UUID and TEXT IDs)';
