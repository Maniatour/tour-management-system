-- Update channel references from VARCHAR to UUID foreign keys
-- Migration: 20250101000005_update_channel_references

-- First, add new channel_id columns if they don't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS channel_id UUID;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS channel_id UUID;

-- Set default channel_id for existing records (assuming first channel as default)
UPDATE customers SET channel_id = (
  SELECT c.id FROM channels c LIMIT 1
) WHERE channel_id IS NULL;

UPDATE reservations SET channel_id = (
  SELECT c.id FROM channels c LIMIT 1
) WHERE channel_id IS NULL;

-- Add foreign key constraints
ALTER TABLE customers ADD CONSTRAINT fk_customers_channel 
  FOREIGN KEY (channel_id) REFERENCES channels(id);

ALTER TABLE reservations ADD CONSTRAINT fk_reservations_channel 
  FOREIGN KEY (channel_id) REFERENCES channels(id);

-- Make channel_id NOT NULL after setting values
ALTER TABLE customers ALTER COLUMN channel_id SET NOT NULL;
ALTER TABLE reservations ALTER COLUMN channel_id SET NOT NULL;

-- Add comments to document the changes
COMMENT ON COLUMN customers.channel_id IS 'Foreign key reference to channels table';
COMMENT ON COLUMN reservations.channel_id IS 'Foreign key reference to channels table';
