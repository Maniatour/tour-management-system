-- Fix product_options table structure to match frontend requirements
-- Migration: 20250101000015_fix_product_options_structure

-- Drop existing product_options table and related constraints
DROP TABLE IF EXISTS product_options CASCADE;

-- Create new product_options table with proper structure
CREATE TABLE product_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  is_multiple BOOLEAN DEFAULT false,
  linked_option_id UUID REFERENCES options(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_option_choices table for option choices
CREATE TABLE product_option_choices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_option_id UUID REFERENCES product_options(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  adult_price_adjustment DECIMAL(10,2) DEFAULT 0,
  child_price_adjustment DECIMAL(10,2) DEFAULT 0,
  infant_price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_product_options_product_id ON product_options(product_id);
CREATE INDEX idx_product_options_linked_option_id ON product_options(linked_option_id);
CREATE INDEX idx_product_option_choices_product_option_id ON product_option_choices(product_option_id);

-- Add comments to document the structure
COMMENT ON TABLE product_options IS 'Product options table with custom names and descriptions';
COMMENT ON TABLE product_option_choices IS 'Individual choices for each product option with price adjustments';

-- Enable RLS (Row Level Security)
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_option_choices ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public access to product_options" ON product_options FOR ALL USING (true);
CREATE POLICY "Allow public access to product_option_choices" ON product_option_choices FOR ALL USING (true);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_product_options_updated_at_trigger 
BEFORE UPDATE ON product_options
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_option_choices_updated_at_trigger 
BEFORE UPDATE ON product_option_choices
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
