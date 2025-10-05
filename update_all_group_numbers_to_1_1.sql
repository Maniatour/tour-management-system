-- 픽업 호텔 테이블의 모든 group_number를 1.1로 업데이트
-- 실행 전에 현재 데이터를 확인하는 것이 좋습니다

-- 1. 현재 group_number 상태 확인
SELECT 
    id,
    hotel,
    group_number,
    pick_up_location
FROM pickup_hotels 
ORDER BY id;

-- 2. 모든 group_number를 1.1로 업데이트
UPDATE pickup_hotels 
SET group_number = '1.1'
WHERE group_number IS NOT NULL 
   OR group_number IS NULL;

-- 3. 업데이트 결과 확인
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN group_number = '1.1' THEN 1 END) as updated_records,
    COUNT(CASE WHEN group_number IS NULL THEN 1 END) as null_records
FROM pickup_hotels;

-- 4. 업데이트된 데이터 확인
SELECT 
    id,
    hotel,
    group_number,
    pick_up_location
FROM pickup_hotels 
ORDER BY id;
