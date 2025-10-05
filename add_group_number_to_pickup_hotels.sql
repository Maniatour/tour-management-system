-- 픽업 호텔 테이블에 그룹 번호 필드 추가
-- 이 필드는 호텔을 그룹화하고 픽업 요청 시 반올림 로직에 사용됩니다.

-- 그룹 번호 필드 추가 (소숫점 지원)
ALTER TABLE pickup_hotels 
ADD COLUMN IF NOT EXISTS group_number DECIMAL(3,1);

-- 그룹 번호에 대한 인덱스 생성 (정렬 및 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_group_number ON pickup_hotels(group_number);

-- 그룹 번호가 NULL이 아닌 경우에 대한 체크 제약 조건 추가
ALTER TABLE pickup_hotels 
ADD CONSTRAINT IF NOT EXISTS chk_group_number_positive 
CHECK (group_number IS NULL OR group_number > 0);

-- 기존 호텔들에 기본 그룹 번호 할당 (예시)
-- 실제 데이터에 맞게 조정이 필요할 수 있습니다.
UPDATE pickup_hotels 
SET group_number = 1.0 
WHERE group_number IS NULL 
AND hotel ILIKE '%bellagio%';

UPDATE pickup_hotels 
SET group_number = 1.1 
WHERE group_number IS NULL 
AND hotel ILIKE '%planet hollywood%';

UPDATE pickup_hotels 
SET group_number = 2.0 
WHERE group_number IS NULL 
AND hotel ILIKE '%caesars%';

-- 그룹 번호가 설정되지 않은 호텔들을 위한 기본값 설정
UPDATE pickup_hotels 
SET group_number = 99.0 
WHERE group_number IS NULL;

-- 변경사항 확인을 위한 쿼리
SELECT 
    hotel,
    group_number,
    address,
    CASE 
        WHEN group_number IS NOT NULL THEN 
            CONCAT('그룹 ', FLOOR(group_number), ' (', group_number, ')')
        ELSE '그룹 미설정'
    END as group_info
FROM pickup_hotels 
ORDER BY group_number, hotel;
