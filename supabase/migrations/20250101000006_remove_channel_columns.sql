-- Remove old channel columns completely
-- Migration: 20250101000006_remove_channel_columns

-- Remove channel column from reservations table if it still exists
ALTER TABLE reservations DROP COLUMN IF EXISTS channel;

-- Remove channel column from customers table if it still exists  
ALTER TABLE customers DROP COLUMN IF EXISTS channel;

-- Verify the current structure
-- reservations table should have: channel_id UUID REFERENCES channels(id)
-- customers table should have: channel_id UUID REFERENCES channels(id)

-- Add comments to document the final structure
COMMENT ON TABLE reservations IS 'Reservations table with channel_id foreign key reference';
COMMENT ON TABLE customers IS 'Customers table with channel_id foreign key reference';
