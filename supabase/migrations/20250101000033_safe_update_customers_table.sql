-- Safe update of customers table structure
-- This migration preserves existing data while updating the table structure

-- Step 1: Create a backup of existing data
CREATE TABLE customers_backup AS SELECT * FROM customers;

-- Step 2: Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'name') THEN
    ALTER TABLE customers ADD COLUMN name VARCHAR(255);
  END IF;
  
  -- Add address column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'address') THEN
    ALTER TABLE customers ADD COLUMN address TEXT;
  END IF;
  
  -- Add language column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'language') THEN
    ALTER TABLE customers ADD COLUMN language VARCHAR(10) DEFAULT 'ko';
  END IF;
  
  -- Add booking_count column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'booking_count') THEN
    ALTER TABLE customers ADD COLUMN booking_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Step 3: Remove old columns that are no longer needed
DO $$ 
BEGIN
  -- Remove nationality column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'nationality') THEN
    ALTER TABLE customers DROP COLUMN nationality;
  END IF;
  
  -- Remove passport_number column if it exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'passport_number') THEN
    ALTER TABLE customers DROP COLUMN passport_number;
  END IF;
END $$;

-- Step 4: Update column constraints and defaults
ALTER TABLE customers 
  ALTER COLUMN name_en DROP NOT NULL,
  ALTER COLUMN language SET DEFAULT 'ko',
  ALTER COLUMN booking_count SET DEFAULT 0,
  ALTER COLUMN status SET DEFAULT 'active';

-- Step 4.5: Update name column with combined name_ko and name_en
UPDATE customers 
SET name = CASE 
  WHEN name_en IS NOT NULL AND name_en != '' THEN name_ko || ' (' || name_en || ')'
  ELSE name_ko
END
WHERE name IS NULL;

-- Step 5: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_channel_id ON customers(channel_id);

-- Step 6: Add foreign key constraint for channel_id if channels table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    -- Drop existing constraint if it exists
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS fk_customers_channel;
    
    -- Add new constraint
    ALTER TABLE customers 
    ADD CONSTRAINT fk_customers_channel 
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Add comments for documentation
COMMENT ON TABLE customers IS '고객 정보 테이블';
COMMENT ON COLUMN customers.id IS '고객 고유 식별자';
COMMENT ON COLUMN customers.name IS '고객 이름 (name_ko + name_en)';
COMMENT ON COLUMN customers.name_ko IS '한국어 이름';
COMMENT ON COLUMN customers.name_en IS '영어 이름';
COMMENT ON COLUMN customers.phone IS '전화번호';
COMMENT ON COLUMN customers.emergency_contact IS '비상연락처';
COMMENT ON COLUMN customers.email IS '이메일 주소';
COMMENT ON COLUMN customers.address IS '주소';
COMMENT ON COLUMN customers.language IS '선호 언어 (ko: 한국어, en: 영어)';
COMMENT ON COLUMN customers.special_requests IS '특별요청사항';
COMMENT ON COLUMN customers.booking_count IS '예약 횟수';
COMMENT ON COLUMN customers.channel_id IS '채널 ID (channels 테이블 참조)';
COMMENT ON COLUMN customers.status IS '상태 (active: 활성, inactive: 비활성)';
COMMENT ON COLUMN customers.created_at IS '등록일시';

-- Step 8: Verify the table structure
DO $$ 
BEGIN
  RAISE NOTICE 'Customers table structure updated successfully';
  RAISE NOTICE 'Backup table created as customers_backup';
END $$;
