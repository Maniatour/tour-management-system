-- payment_methods 테이블에 표시용 컬럼 추가
-- Migration: 20250203000003_add_display_name_to_payment_methods

begin;

-- display_name 컬럼 추가 (ID와 방법명을 조합한 표시용)
ALTER TABLE payment_methods 
ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- 기존 데이터에 display_name 업데이트
-- 형식: "ID - 방법명" 또는 "방법명" (ID가 PAYM으로 시작하는 경우만 ID 포함)
UPDATE payment_methods
SET display_name = CASE
    WHEN id LIKE 'PAYM%' THEN id || ' - ' || method
    ELSE method
END
WHERE display_name IS NULL;

-- display_name이 NULL인 경우 method를 기본값으로 설정
UPDATE payment_methods
SET display_name = method
WHERE display_name IS NULL;

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_payment_methods_display_name 
ON payment_methods(display_name);

commit;
