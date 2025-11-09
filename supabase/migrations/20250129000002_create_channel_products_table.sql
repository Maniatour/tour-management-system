-- Create channel_products table to store channel-product relationships
-- Migration: 20250129000002_create_channel_products_table
-- 
-- This table stores which products are available for sale in which channels.
-- This is separate from dynamic_pricing which stores date-specific pricing information.

-- Create channel_products table
CREATE TABLE IF NOT EXISTS channel_products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one product can only be linked to a channel once
  UNIQUE(channel_id, product_id)
);

-- Add comment to explain the table
COMMENT ON TABLE channel_products IS
  'Stores which products are available for sale in which channels. This is a many-to-many relationship between channels and products.';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_channel_products_channel ON channel_products(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_products_product ON channel_products(product_id);
CREATE INDEX IF NOT EXISTS idx_channel_products_active ON channel_products(is_active);
CREATE INDEX IF NOT EXISTS idx_channel_products_composite ON channel_products(channel_id, product_id);

-- Enable RLS
ALTER TABLE channel_products ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (allow all access for now, can be restricted later)
CREATE POLICY "Allow public access to channel_products" ON channel_products
  FOR ALL USING (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_channel_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_channel_products_updated_at_trigger
  BEFORE UPDATE ON channel_products
  FOR EACH ROW
  EXECUTE FUNCTION update_channel_products_updated_at();

