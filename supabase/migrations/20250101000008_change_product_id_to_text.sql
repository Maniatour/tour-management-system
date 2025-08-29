-- Change product table id from UUID to TEXT
-- This migration changes the product table id column type from UUID to TEXT

-- Step 1: Drop the audit_logs_view that depends on the products table
DROP VIEW IF EXISTS audit_logs_view;

-- Step 2: Drop ALL foreign key constraints that reference products.id
ALTER TABLE tours DROP CONSTRAINT IF EXISTS tours_product_id_fkey;
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_product_id_fkey;
ALTER TABLE product_options DROP CONSTRAINT IF EXISTS product_options_product_id_fkey;
ALTER TABLE dynamic_pricing DROP CONSTRAINT IF EXISTS dynamic_pricing_product_id_fkey;

-- Step 3: Drop the primary key constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pkey;

-- Step 4: Change the id column type from UUID to TEXT
ALTER TABLE products ALTER COLUMN id TYPE TEXT;

-- Step 5: Change the referencing columns to TEXT as well
ALTER TABLE tours ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE reservations ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE product_options ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE dynamic_pricing ALTER COLUMN product_id TYPE TEXT;

-- Step 6: Add a new primary key constraint
ALTER TABLE products ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- Step 7: Recreate ALL foreign key constraints with the new TEXT type
ALTER TABLE tours ADD CONSTRAINT tours_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE reservations ADD CONSTRAINT reservations_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE product_options ADD CONSTRAINT product_options_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE dynamic_pricing ADD CONSTRAINT dynamic_pricing_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
