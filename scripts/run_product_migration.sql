-- 상품 ID 마이그레이션 실행 스크립트
-- 실행 전에 반드시 데이터베이스 백업을 수행하세요!

-- 1. 현재 상태 확인
SELECT '=== 현재 예약 데이터 현황 ===' as status;
SELECT * FROM current_reservation_status;

SELECT '=== 상품 옵션 확인 ===' as status;
SELECT * FROM product_options_check;

-- 2. 백업 테이블 생성 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS reservations_backup_before_product_migration AS
SELECT * FROM reservations WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X');

-- 3. 마이그레이션 실행
SELECT '=== 마이그레이션 실행 ===' as status;
SELECT * FROM migrate_product_ids();

-- 4. 결과 확인
SELECT '=== 마이그레이션 후 상태 ===' as status;
SELECT * FROM migration_results;

SELECT '=== 옵션 추가 결과 ===' as status;
SELECT * FROM option_migration_results LIMIT 10;

-- 5. 최종 검증
SELECT '=== 최종 검증 ===' as status;
SELECT 
    'MDGCSUNRISE' as product_id,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN selected_options IS NULL OR selected_options = '{}'::jsonb THEN 1 END) as no_options,
    COUNT(CASE WHEN selected_options IS NOT NULL AND selected_options != '{}'::jsonb THEN 1 END) as has_options
FROM reservations 
WHERE product_id = 'MDGCSUNRISE';

-- 6. 옵션별 분포 확인
SELECT 
    CASE 
        WHEN selected_options ? (SELECT id::text FROM product_options WHERE product_id = 'MDGCSUNRISE' AND name = 'Lower Antelope Canyon' LIMIT 1) 
        THEN 'Lower Antelope Canyon'
        WHEN selected_options ? (SELECT id::text FROM product_options WHERE product_id = 'MDGCSUNRISE' AND name = 'Antelope X Canyon' LIMIT 1) 
        THEN 'Antelope X Canyon'
        ELSE 'No option'
    END as option_type,
    COUNT(*) as count
FROM reservations 
WHERE product_id = 'MDGCSUNRISE'
GROUP BY option_type
ORDER BY count DESC;
