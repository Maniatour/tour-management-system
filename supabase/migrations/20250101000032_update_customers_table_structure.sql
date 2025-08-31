-- Update customers table structure to match new requirements
-- Remove old columns and add new ones

-- First, drop the existing customers table if it exists
DROP TABLE IF EXISTS customers CASCADE;

-- Create new customers table with updated structure
CREATE TABLE customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  name_ko VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  emergency_contact VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  address TEXT,
  language VARCHAR(10) DEFAULT 'ko',
  special_requests TEXT,
  booking_count INTEGER DEFAULT 0,
  channel_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_customers_channel_id ON customers(channel_id);

-- Add foreign key constraint for channel_id if channels table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'channels') THEN
    ALTER TABLE customers 
    ADD CONSTRAINT fk_customers_channel 
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments for documentation
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
