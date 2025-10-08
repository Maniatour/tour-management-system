-- Add customer_website, admin_website, and favicon_url columns to channels table
-- This migration adds separate website columns for customer and admin access

-- Add new website columns
ALTER TABLE channels ADD COLUMN IF NOT EXISTS customer_website VARCHAR(500);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS admin_website VARCHAR(500);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500);

-- Add comments to explain the new columns
COMMENT ON COLUMN channels.customer_website IS 'Customer-facing website URL for this channel';
COMMENT ON COLUMN channels.admin_website IS 'Admin panel website URL for this channel';
COMMENT ON COLUMN channels.favicon_url IS 'Favicon URL for this channel';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_channels_customer_website ON channels(customer_website);
CREATE INDEX IF NOT EXISTS idx_channels_admin_website ON channels(admin_website);
CREATE INDEX IF NOT EXISTS idx_channels_favicon_url ON channels(favicon_url);

-- Update existing data: move current website to customer_website
UPDATE channels 
SET customer_website = website 
WHERE website IS NOT NULL AND customer_website IS NULL;

-- Keep the original website column for backward compatibility
-- (we won't drop it to avoid breaking existing code)
