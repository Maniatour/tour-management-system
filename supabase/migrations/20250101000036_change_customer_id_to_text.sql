-- Change customer ID from UUID to text type
-- This migration allows custom text IDs for customers

-- Step 1: Create a backup of current data
CREATE TABLE customers_backup_v4 AS SELECT * FROM customers;

-- Step 2: Create a new customers table with text ID
CREATE TABLE customers_new (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  emergency_contact VARCHAR(255),
  email VARCHAR(255),
  address TEXT,
  language VARCHAR(10) DEFAULT 'ko',
  special_requests TEXT,
  booking_count INTEGER DEFAULT 0,
  channel_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Copy data from old table to new table
INSERT INTO customers_new 
SELECT 
  id::TEXT,
  name,
  phone,
  emergency_contact,
  email,
  address,
  language,
  special_requests,
  booking_count,
  channel_id,
  status,
  created_at
FROM customers;

-- Step 4: Drop old table and rename new table
DROP TABLE customers;
ALTER TABLE customers_new RENAME TO customers;

-- Step 5: Recreate indexes
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_channel_id ON customers(channel_id);

-- Step 6: Recreate foreign key constraints
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    ALTER TABLE customers 
    ADD CONSTRAINT fk_customers_channel 
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 7: Update comments
COMMENT ON TABLE customers IS '고객 정보 테이블';
COMMENT ON COLUMN customers.id IS '고객 고유 식별자 (텍스트)';
COMMENT ON COLUMN customers.name IS '고객 이름';
COMMENT ON COLUMN customers.phone IS '전화번호 (선택사항)';
COMMENT ON COLUMN customers.emergency_contact IS '비상연락처';
COMMENT ON COLUMN customers.email IS '이메일 주소 (선택사항)';
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
  RAISE NOTICE 'Backup table created as customers_backup_v4';
  RAISE NOTICE 'Customer ID changed from UUID to TEXT type';
END $$;
