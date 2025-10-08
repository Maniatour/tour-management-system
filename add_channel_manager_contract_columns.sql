-- Add manager and contract columns to channels table
-- This migration adds manager information and contract upload functionality

-- Add new columns for manager information and contract
ALTER TABLE channels ADD COLUMN IF NOT EXISTS manager_name VARCHAR(255);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS manager_contact VARCHAR(255);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS contract_url VARCHAR(500);

-- Add comments to explain the new columns
COMMENT ON COLUMN channels.manager_name IS 'Name of the channel manager/contact person';
COMMENT ON COLUMN channels.manager_contact IS 'Contact information (phone, email) of the channel manager';
COMMENT ON COLUMN channels.contract_url IS 'URL of the uploaded contract document';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_channels_manager_name ON channels(manager_name);
CREATE INDEX IF NOT EXISTS idx_channels_contract_url ON channels(contract_url);
