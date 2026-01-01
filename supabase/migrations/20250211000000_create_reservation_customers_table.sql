-- 예약-고객 다대다 관계 테이블 생성
-- 한 예약에 여러 고객이 있고, 각 고객이 다른 resident_status를 가질 수 있도록 지원
-- 작성일: 2025-02-11

-- reservation_customers 테이블 생성
CREATE TABLE IF NOT EXISTS reservation_customers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  
  -- 예약 시점의 거주 상태 (예약별로 다른 상태를 가질 수 있음)
  resident_status VARCHAR(50) CHECK (
    resident_status IN ('us_resident', 'non_resident', 'non_resident_with_pass')
  ),
  
  -- 패스 정보 (패스 1장으로 여러 인원을 커버하는 경우)
  pass_covered_count INTEGER DEFAULT 0, -- 패스로 커버되는 인원 수 (0이면 패스 없음)
  pass_photo_url TEXT, -- 패스 사진 URL (패스가 있는 경우)
  id_photo_url TEXT, -- ID 사진 URL (패스가 있는 경우)
  
  -- 고객 정보 (customer_id가 없는 경우를 대비한 직접 입력 정보)
  name TEXT, -- 고객 이름 (customer_id가 없는 경우)
  name_ko TEXT, -- 한국어 이름
  name_en TEXT, -- 영어 이름
  phone TEXT, -- 전화번호
  email TEXT, -- 이메일
  
  -- 예약 내 고객 순서
  order_index INTEGER DEFAULT 0,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 제약조건: customer_id와 직접 입력 정보 중 하나는 필수
  CONSTRAINT chk_reservation_customer_info CHECK (
    customer_id IS NOT NULL OR (name IS NOT NULL)
  )
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservation_customers_reservation_id 
  ON reservation_customers(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_customers_customer_id 
  ON reservation_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservation_customers_resident_status 
  ON reservation_customers(resident_status);
CREATE INDEX IF NOT EXISTS idx_reservation_customers_order_index 
  ON reservation_customers(reservation_id, order_index);

-- 주석 추가
COMMENT ON TABLE reservation_customers IS '예약-고객 다대다 관계 테이블. 한 예약에 여러 고객이 있고, 각 고객이 다른 resident_status를 가질 수 있음';
COMMENT ON COLUMN reservation_customers.reservation_id IS '예약 ID';
COMMENT ON COLUMN reservation_customers.customer_id IS '고객 ID (기존 customers 테이블 참조, NULL 가능)';
COMMENT ON COLUMN reservation_customers.resident_status IS '예약 시점의 거주 상태: us_resident(미국 거주자), non_resident(비거주자), non_resident_with_pass(비거주자 패스 보유)';
COMMENT ON COLUMN reservation_customers.pass_covered_count IS '패스로 커버되는 인원 수 (0이면 패스 없음, 1 이상이면 패스로 해당 인원 수만큼 커버)';
COMMENT ON COLUMN reservation_customers.pass_photo_url IS '패스 사진 URL (패스가 있는 경우)';
COMMENT ON COLUMN reservation_customers.id_photo_url IS 'ID 사진 URL (패스가 있는 경우)';
COMMENT ON COLUMN reservation_customers.name IS '고객 이름 (customer_id가 없는 경우 직접 입력)';
COMMENT ON COLUMN reservation_customers.order_index IS '예약 내 고객 순서';

-- customers 테이블의 resident_status를 nullable로 변경
-- (기존 고객 정보는 유지하되, 예약별로 다른 상태를 가질 수 있도록)
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- resident_status 컬럼이 이미 존재하는 경우에만 제약조건 수정
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'resident_status'
  ) THEN
    -- 기존 CHECK 제약조건 제거 (제약조건 이름을 찾아서 제거)
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'customers'::regclass
      AND contype = 'c'
      AND conname LIKE '%resident_status%'
    LIMIT 1;
    
    IF constraint_name IS NOT NULL THEN
      EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
    END IF;
    
    -- resident_status를 nullable로 변경하고 새로운 제약조건 추가 (nullable 허용)
    ALTER TABLE customers 
      ALTER COLUMN resident_status DROP NOT NULL;
    
    -- 새로운 제약조건 추가 (NULL 허용)
    ALTER TABLE customers 
      ADD CONSTRAINT chk_customers_resident_status 
      CHECK (
        resident_status IS NULL OR 
        resident_status IN ('us_resident', 'non_resident', 'non_resident_with_pass')
      );
    
    -- 주석 업데이트
    COMMENT ON COLUMN customers.resident_status IS '기본 거주 상태 (선택사항). 예약별로 다른 상태를 가질 수 있으므로 reservation_customers 테이블의 resident_status를 우선 사용';
  END IF;
END $$;

