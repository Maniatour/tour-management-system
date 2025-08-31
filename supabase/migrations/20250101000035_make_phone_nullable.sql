-- Make phone column nullable
-- This migration allows customers to be created without phone numbers

-- Step 1: Create a backup of current data
CREATE TABLE customers_backup_v3 AS SELECT * FROM customers;

-- Step 2: Make phone column nullable
ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL;

-- Step 3: Update comments
COMMENT ON COLUMN customers.phone IS '전화번호 (선택사항)';

-- Step 4: Verify the table structure
DO $$ 
BEGIN
  RAISE NOTICE 'Customers table structure updated successfully';
  RAISE NOTICE 'Backup table created as customers_backup_v3';
  RAISE NOTICE 'phone column is now nullable';
END $$;
