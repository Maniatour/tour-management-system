-- 고객 테이블에 거주 상태(resident_status) 컬럼 추가
-- 작성일: 2025-02-07

-- customers 테이블에 resident_status 컬럼 추가
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'resident_status'
  ) THEN
    ALTER TABLE customers 
    ADD COLUMN resident_status VARCHAR(50) CHECK (
      resident_status IN ('us_resident', 'non_resident', 'non_resident_with_pass')
    );
    
    -- 주석 추가
    COMMENT ON COLUMN customers.resident_status IS '거주 상태: us_resident(미국 거주자), non_resident(비거주자), non_resident_with_pass(비거주자 패스 보유)';
  END IF;
END $$;

-- 인덱스 추가 (필요시 조회 성능 향상)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_customers_resident_status'
  ) THEN
    CREATE INDEX idx_customers_resident_status ON customers(resident_status);
  END IF;
END $$;




