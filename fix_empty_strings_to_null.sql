-- 기존 데이터에서 빈 문자열을 null로 변환
-- 데이터베이스 제약 조건 위반 문제 해결

-- 1. two_guide_schedule 컬럼의 빈 문자열을 null로 변환
UPDATE product_schedules 
SET two_guide_schedule = NULL 
WHERE two_guide_schedule = '';

-- 2. guide_driver_schedule 컬럼의 빈 문자열을 null로 변환
UPDATE product_schedules 
SET guide_driver_schedule = NULL 
WHERE guide_driver_schedule = '';

-- 3. 변환 결과 확인
SELECT 
    COUNT(*) as total_schedules,
    COUNT(two_guide_schedule) as two_guide_schedule_count,
    COUNT(guide_driver_schedule) as guide_driver_schedule_count,
    COUNT(CASE WHEN two_guide_schedule = 'guide' THEN 1 END) as two_guide_guide_count,
    COUNT(CASE WHEN two_guide_schedule = 'assistant' THEN 1 END) as two_guide_assistant_count,
    COUNT(CASE WHEN guide_driver_schedule = 'guide' THEN 1 END) as guide_driver_guide_count,
    COUNT(CASE WHEN guide_driver_schedule = 'assistant' THEN 1 END) as guide_driver_assistant_count
FROM product_schedules;

-- 4. 샘플 데이터 확인
SELECT 
    id,
    product_id,
    title_ko,
    two_guide_schedule,
    guide_driver_schedule,
    created_at
FROM product_schedules 
WHERE two_guide_schedule IS NOT NULL OR guide_driver_schedule IS NOT NULL
LIMIT 10;
