-- Change channels table id from UUID to TEXT
-- This migration changes the channels table id column type from UUID to TEXT

-- First, drop the audit_logs_view that depends on the channels table
DROP VIEW IF EXISTS audit_logs_view;

-- Drop foreign key constraints that reference channels.id (using actual constraint names)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS fk_customers_channel;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS fk_reservations_channel;
ALTER TABLE dynamic_pricing DROP CONSTRAINT IF EXISTS dynamic_pricing_channel_id_fkey;

-- Change the referenced columns to TEXT type as well
ALTER TABLE customers ALTER COLUMN channel_id TYPE TEXT;
ALTER TABLE reservations ALTER COLUMN channel_id TYPE TEXT;
ALTER TABLE dynamic_pricing ALTER COLUMN channel_id TYPE TEXT;

-- Drop the primary key constraint
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_pkey;

-- Change the id column type from UUID to TEXT
ALTER TABLE channels ALTER COLUMN id TYPE TEXT;

-- Add a new primary key constraint
ALTER TABLE channels ADD CONSTRAINT channels_pkey PRIMARY KEY (id);

-- Recreate foreign key constraints with the new TEXT type
ALTER TABLE customers ADD CONSTRAINT fk_customers_channel 
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;

ALTER TABLE reservations ADD CONSTRAINT fk_reservations_channel 
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;

ALTER TABLE dynamic_pricing ADD CONSTRAINT dynamic_pricing_channel_id_fkey 
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE;

-- Recreate the audit_logs_view
CREATE OR REPLACE VIEW audit_logs_view AS
SELECT 
  al.id,
  al.table_name,
  al.record_id,
  al.action,
  al.old_values,
  al.new_values,
  al.changed_fields,
  al.user_id,
  al.user_email,
  al.ip_address,
  al.user_agent,
  al.created_at,
  CASE 
    WHEN al.table_name = 'products' THEN 'Product ' || al.record_id
    WHEN al.table_name = 'customers' THEN 'Customer ' || al.record_id
    WHEN al.table_name = 'employees' THEN 'Employee ' || al.record_id
    WHEN al.table_name = 'options' THEN 'Option ' || al.record_id
    WHEN al.table_name = 'tours' THEN '투어 #' || al.record_id
    WHEN al.table_name = 'reservations' THEN '예약 #' || al.record_id
    WHEN al.table_name = 'channels' THEN 'Channel ' || al.record_id
    WHEN al.table_name = 'dynamic_pricing' THEN '동적가격 #' || al.record_id
    ELSE al.record_id
  END as record_name
FROM audit_logs al
ORDER BY al.created_at DESC;

-- Add comment to explain the change
COMMENT ON COLUMN channels.id IS 'Channel ID (TEXT type for flexible naming)';
