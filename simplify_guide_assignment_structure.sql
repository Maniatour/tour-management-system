-- 가이드 할당 구조 단순화
-- Migration: Simplify guide assignment structure

-- 1. 새로운 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS two_guide_schedule VARCHAR(20) CHECK (two_guide_schedule IN ('guide', 'assistant')),
ADD COLUMN IF NOT EXISTS guide_driver_schedule VARCHAR(20) CHECK (guide_driver_schedule IN ('guide', 'assistant'));

-- 2. 기존 데이터 마이그레이션
-- 2가이드 담당 일정 데이터 마이그레이션
UPDATE product_schedules 
SET two_guide_schedule = CASE 
    WHEN assigned_guide_1 = 'guide' THEN 'guide'
    WHEN assigned_guide_2 = 'assistant' THEN 'assistant'
    ELSE NULL
END
WHERE guide_assignment_type = 'two_guides';

-- 가이드+드라이버 담당 일정 데이터 마이그레이션
UPDATE product_schedules 
SET guide_driver_schedule = CASE 
    WHEN assigned_guide_driver_guide = 'guide' THEN 'guide'
    WHEN assigned_guide_driver_driver = 'driver' THEN 'assistant'  -- driver를 assistant로 매핑
    ELSE NULL
END
WHERE guide_assignment_type = 'guide_driver';

-- 3. 불필요한 컬럼 삭제
ALTER TABLE product_schedules 
DROP COLUMN IF EXISTS assigned_guide_1,
DROP COLUMN IF EXISTS assigned_guide_2,
DROP COLUMN IF EXISTS assigned_driver,
DROP COLUMN IF EXISTS assigned_guide_driver_guide,
DROP COLUMN IF EXISTS assigned_guide_driver_driver;

-- 4. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_two_guide_schedule ON product_schedules(two_guide_schedule);
CREATE INDEX IF NOT EXISTS idx_product_schedules_guide_driver_schedule ON product_schedules(guide_driver_schedule);

-- 5. 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND (column_name LIKE '%guide%' OR column_name LIKE '%driver%' OR column_name LIKE '%schedule%')
ORDER BY ordinal_position;

-- 6. 데이터 확인
SELECT 
    id,
    guide_assignment_type,
    two_guide_schedule,
    guide_driver_schedule
FROM product_schedules 
WHERE guide_assignment_type IN ('two_guides', 'guide_driver')
LIMIT 10;
