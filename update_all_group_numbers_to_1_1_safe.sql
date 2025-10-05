-- 픽업 호텔 테이블의 모든 group_number를 1.1로 업데이트 (안전한 버전)
-- 트랜잭션을 사용하여 롤백 가능하도록 구성

BEGIN;

-- 1. 현재 상태 백업 (선택사항)
-- CREATE TABLE pickup_hotels_backup AS 
-- SELECT * FROM pickup_hotels;

-- 2. 현재 group_number 상태 확인
SELECT 
    'BEFORE UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN group_number = '1.1' THEN 1 END) as already_1_1,
    COUNT(CASE WHEN group_number IS NOT NULL AND group_number != '1.1' THEN 1 END) as other_values,
    COUNT(CASE WHEN group_number IS NULL THEN 1 END) as null_values
FROM pickup_hotels;

-- 3. 모든 group_number를 1.1로 업데이트
UPDATE pickup_hotels 
SET group_number = '1.1';

-- 4. 업데이트 결과 확인
SELECT 
    'AFTER UPDATE' as status,
    COUNT(*) as total_records,
    COUNT(CASE WHEN group_number = '1.1' THEN 1 END) as updated_to_1_1,
    COUNT(CASE WHEN group_number IS NULL THEN 1 END) as still_null
FROM pickup_hotels;

-- 5. 샘플 데이터 확인
SELECT 
    id,
    hotel,
    group_number,
    pick_up_location
FROM pickup_hotels 
ORDER BY id
LIMIT 10;

-- 6. 커밋 (모든 것이 정상이면)
COMMIT;

-- 만약 문제가 있다면 다음 명령어로 롤백:
-- ROLLBACK;
