-- reservation_customers 테이블의 resident_status에 'non_resident_under_16' (비 거주자 16세 이하) 추가
-- 작성일: 2025-01-16

-- reservation_customers 테이블의 resident_status CHECK 제약조건 업데이트
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- 기존 CHECK 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'reservation_customers'::regclass
    AND contype = 'c'
    AND conname LIKE '%resident_status%'
  LIMIT 1;
  
  IF constraint_name IS NOT NULL THEN
    -- 기존 제약조건 제거
    EXECUTE 'ALTER TABLE reservation_customers DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
  END IF;
  
  -- 새로운 제약조건 추가 (non_resident_under_16 포함)
  ALTER TABLE reservation_customers 
    ADD CONSTRAINT chk_reservation_customers_resident_status 
    CHECK (
      resident_status IN (
        'us_resident', 
        'non_resident', 
        'non_resident_with_pass',
        'non_resident_under_16'
      )
    );
  
  -- 주석 업데이트
  COMMENT ON COLUMN reservation_customers.resident_status IS 
    '예약 시점의 거주 상태: us_resident(미국 거주자), non_resident(비거주자), non_resident_with_pass(비거주자 패스 보유), non_resident_under_16(비 거주자 16세 이하)';
END $$;

-- customers 테이블의 resident_status CHECK 제약조건도 업데이트
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- customers 테이블의 resident_status CHECK 제약조건 찾기
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'customers'::regclass
    AND contype = 'c'
    AND conname LIKE '%resident_status%'
  LIMIT 1;
  
  IF constraint_name IS NOT NULL THEN
    -- 기존 제약조건 제거
    EXECUTE 'ALTER TABLE customers DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_name);
  END IF;
  
  -- 새로운 제약조건 추가 (non_resident_under_16 포함, NULL 허용)
  ALTER TABLE customers 
    ADD CONSTRAINT chk_customers_resident_status 
    CHECK (
      resident_status IS NULL OR 
      resident_status IN (
        'us_resident', 
        'non_resident', 
        'non_resident_with_pass',
        'non_resident_under_16'
      )
    );
  
  -- 주석 업데이트
  COMMENT ON COLUMN customers.resident_status IS 
    '기본 거주 상태 (선택사항). 예약별로 다른 상태를 가질 수 있으므로 reservation_customers 테이블의 resident_status를 우선 사용. 값: us_resident(미국 거주자), non_resident(비거주자), non_resident_with_pass(비거주자 패스 보유), non_resident_under_16(비 거주자 16세 이하)';
END $$;
