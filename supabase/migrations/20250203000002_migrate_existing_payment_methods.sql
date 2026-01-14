-- 기존 테이블의 payment_method 값들을 payment_methods 테이블에 자동 생성
-- Migration: 20250203000002_migrate_existing_payment_methods

begin;

-- 1. 기존 payment_method 값들을 수집하는 임시 테이블 생성
CREATE TEMP TABLE temp_payment_methods AS
SELECT DISTINCT payment_method as method_id
FROM (
    SELECT payment_method FROM payment_records WHERE payment_method IS NOT NULL
    UNION
    SELECT payment_method FROM company_expenses WHERE payment_method IS NOT NULL
    UNION
    SELECT payment_method FROM reservation_expenses WHERE payment_method IS NOT NULL
    UNION
    SELECT payment_method FROM tour_expenses WHERE payment_method IS NOT NULL
) AS all_methods
WHERE payment_method IS NOT NULL AND payment_method != '';

-- 2. payment_methods 테이블에 없는 ID들을 자동 생성
-- PAYM으로 시작하는 ID는 그대로 사용, 그 외는 자동으로 method_type 감지
INSERT INTO payment_methods (id, method, method_type, user_email, status, notes)
SELECT 
    t.method_id as id,
    -- ID에서 method 이름 추출 (PAYM032 -> "PAYM032" 또는 더 읽기 쉬운 이름)
    CASE 
        WHEN t.method_id LIKE 'PAYM%' THEN t.method_id
        WHEN LOWER(t.method_id) LIKE '%cash%' OR LOWER(t.method_id) LIKE '%현금%' THEN '현금'
        WHEN LOWER(t.method_id) LIKE '%card%' OR LOWER(t.method_id) LIKE '%cc%' THEN t.method_id
        WHEN LOWER(t.method_id) LIKE '%transfer%' OR LOWER(t.method_id) LIKE '%이체%' THEN '계좌이체'
        ELSE t.method_id
    END as method,
    -- method_type 자동 감지
    CASE 
        WHEN LOWER(t.method_id) LIKE '%cash%' OR LOWER(t.method_id) LIKE '%현금%' THEN 'cash'
        WHEN LOWER(t.method_id) LIKE '%card%' OR LOWER(t.method_id) LIKE '%cc%' OR t.method_id ~ '^\d{4}$' THEN 'card'
        WHEN LOWER(t.method_id) LIKE '%transfer%' OR LOWER(t.method_id) LIKE '%이체%' OR LOWER(t.method_id) LIKE '%계좌%' THEN 'transfer'
        WHEN LOWER(t.method_id) LIKE '%mobile%' OR LOWER(t.method_id) LIKE '%모바일%' THEN 'mobile'
        ELSE 'other'
    END as method_type,
    NULL as user_email, -- 기존 데이터는 고객용으로 간주 (필요시 수정 가능)
    'active' as status,
    '기존 시스템에서 자동 마이그레이션됨' as notes
FROM temp_payment_methods t
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods pm WHERE pm.id = t.method_id
);

-- 3. 통계 출력 (확인용)
DO $$
DECLARE
    created_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO created_count FROM payment_methods WHERE notes = '기존 시스템에서 자동 마이그레이션됨';
    SELECT COUNT(*) INTO total_count FROM temp_payment_methods;
    
    RAISE NOTICE '총 %개의 고유한 payment_method 발견, %개가 payment_methods 테이블에 생성됨', total_count, created_count;
END $$;

-- 4. 임시 테이블 정리
DROP TABLE IF EXISTS temp_payment_methods;

commit;
