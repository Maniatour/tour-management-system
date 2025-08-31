-- Remove name_ko and name_en columns, make email nullable
-- This migration simplifies the customers table structure

-- Step 1: Create a backup of current data
CREATE TABLE customers_backup_v2 AS SELECT * FROM customers;

-- Step 2: Remove name_ko and name_en columns
ALTER TABLE customers DROP COLUMN IF EXISTS name_ko;
ALTER TABLE customers DROP COLUMN IF EXISTS name_en;

-- Step 3: Make email column nullable
ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;

-- Step 4: Remove unique constraint from email (since it's now nullable)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_key;

-- Step 5: Update comments
COMMENT ON COLUMN customers.name IS '고객 이름';
COMMENT ON COLUMN customers.email IS '이메일 주소 (선택사항)';

-- Step 6: Verify the table structure
DO $$ 
BEGIN
  RAISE NOTICE 'Customers table structure updated successfully';
  RAISE NOTICE 'Backup table created as customers_backup_v2';
  RAISE NOTICE 'name_ko and name_en columns removed';
  RAISE NOTICE 'email column is now nullable';
END $$;
