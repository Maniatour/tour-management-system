-- Merge product_options and product_option_choices tables
-- Migration: 20250101000050_merge_product_options_tables.sql

-- First, let's see what data we have in both tables
-- This will help us understand the current structure

-- Create a new merged table structure
CREATE TABLE product_options_new (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  is_multiple BOOLEAN DEFAULT false,
  linked_option_id TEXT REFERENCES options(id) ON DELETE SET NULL,
  
  -- Choice-related fields (merged from product_option_choices)
  choice_name VARCHAR(255), -- The actual choice name
  choice_description TEXT,
  adult_price_adjustment DECIMAL(10,2) DEFAULT 0,
  child_price_adjustment DECIMAL(10,2) DEFAULT 0,
  infant_price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for the new table
CREATE INDEX idx_product_options_new_product_id ON product_options_new(product_id);
CREATE INDEX idx_product_options_new_linked_option_id ON product_options_new(linked_option_id);

-- Migrate data from existing tables
-- For each product_option, create a row for each of its choices
INSERT INTO product_options_new (
  id,
  product_id,
  name,
  description,
  is_required,
  is_multiple,
  linked_option_id,
  choice_name,
  choice_description,
  adult_price_adjustment,
  child_price_adjustment,
  infant_price_adjustment,
  is_default,
  created_at,
  updated_at
)
SELECT 
  po.id,
  po.product_id,
  po.name,
  po.description,
  po.is_required,
  po.is_multiple,
  po.linked_option_id,
  poc.name as choice_name,
  poc.description as choice_description,
  poc.adult_price_adjustment,
  poc.child_price_adjustment,
  poc.infant_price_adjustment,
  poc.is_default,
  po.created_at,
  po.updated_at
FROM product_options po
LEFT JOIN product_option_choices poc ON po.id = poc.product_option_id;

-- If there are product_options without choices, create a default choice
INSERT INTO product_options_new (
  id,
  product_id,
  name,
  description,
  is_required,
  is_multiple,
  linked_option_id,
  choice_name,
  choice_description,
  adult_price_adjustment,
  child_price_adjustment,
  infant_price_adjustment,
  is_default,
  created_at,
  updated_at
)
SELECT 
  po.id,
  po.product_id,
  po.name,
  po.description,
  po.is_required,
  po.is_multiple,
  po.linked_option_id,
  po.name as choice_name, -- Use option name as choice name
  po.description as choice_description,
  0 as adult_price_adjustment,
  0 as child_price_adjustment,
  0 as infant_price_adjustment,
  true as is_default,
  po.created_at,
  po.updated_at
FROM product_options po
WHERE NOT EXISTS (
  SELECT 1 FROM product_option_choices poc 
  WHERE poc.product_option_id = po.id
);

-- Drop the old tables
DROP TABLE IF EXISTS product_option_choices CASCADE;
DROP TABLE IF EXISTS product_options CASCADE;

-- Rename the new table to the original name
ALTER TABLE product_options_new RENAME TO product_options;

-- Recreate the trigger
CREATE TRIGGER update_product_options_updated_at_trigger 
BEFORE UPDATE ON product_options
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update any existing reservations that reference the old structure
-- We need to update selected_options to use the new merged structure
-- This is a complex operation, so we'll create a function to handle it

CREATE OR REPLACE FUNCTION migrate_selected_options()
RETURNS void AS $$
DECLARE
    reservation_record RECORD;
    option_id TEXT;
    choice_ids TEXT[];
    new_choice_id TEXT;
BEGIN
    -- For each reservation with selected_options
    FOR reservation_record IN 
        SELECT id, selected_options 
        FROM reservations 
        WHERE selected_options IS NOT NULL 
        AND selected_options != '{}'::jsonb
    LOOP
        -- For each option in selected_options
        FOR option_id IN 
            SELECT jsonb_object_keys(reservation_record.selected_options)
        LOOP
            -- Get the choice IDs for this option
            choice_ids := ARRAY(
                SELECT jsonb_array_elements_text(
                    reservation_record.selected_options->option_id
                )
            );
            
            -- For each choice, find the corresponding new option ID
            -- and update the selected_options
            FOR new_choice_id IN 
                SELECT po.id::text
                FROM product_options po
                WHERE po.id::text = option_id
                OR EXISTS (
                    SELECT 1 FROM product_option_choices poc 
                    WHERE poc.id::text = ANY(choice_ids)
                    AND poc.product_option_id = po.id
                )
            LOOP
                -- Update the reservation with the new structure
                UPDATE reservations 
                SET selected_options = jsonb_set(
                    selected_options,
                    ARRAY[new_choice_id],
                    to_jsonb(choice_ids)
                )
                WHERE id = reservation_record.id;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT migrate_selected_options();

-- Drop the migration function
DROP FUNCTION migrate_selected_options();

-- Add comments to document the new structure
COMMENT ON TABLE product_options IS 'Merged product options table containing both option and choice information';
COMMENT ON COLUMN product_options.choice_name IS 'The actual choice name for this option';
COMMENT ON COLUMN product_options.adult_price_adjustment IS 'Price adjustment for adults when this choice is selected';
COMMENT ON COLUMN product_options.child_price_adjustment IS 'Price adjustment for children when this choice is selected';
COMMENT ON COLUMN product_options.infant_price_adjustment IS 'Price adjustment for infants when this choice is selected';
COMMENT ON COLUMN product_options.is_default IS 'Whether this is the default choice for this option';

-- Enable RLS
ALTER TABLE product_options ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Allow public access to product_options" ON product_options FOR ALL USING (true);
