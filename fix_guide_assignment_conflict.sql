-- 가이드 할당 충돌 문제 해결을 위한 스키마 수정
-- Migration: Fix guide assignment field conflicts

-- 새로운 필드 추가 (가이드+드라이버 전용)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS assigned_guide_driver_guide VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_guide_driver_driver VARCHAR(255);

-- 기존 데이터 마이그레이션
-- assigned_guide_1이 'guide_driver_guide'인 경우를 새로운 필드로 이동
UPDATE product_schedules 
SET assigned_guide_driver_guide = 'guide'
WHERE assigned_guide_1 = 'guide_driver_guide';

-- assigned_driver가 'driver'인 경우를 새로운 필드로 이동
UPDATE product_schedules 
SET assigned_guide_driver_driver = 'driver'
WHERE assigned_driver = 'driver';

-- 기존 충돌 데이터 정리
UPDATE product_schedules 
SET assigned_guide_1 = NULL
WHERE assigned_guide_1 = 'guide_driver_guide';

UPDATE product_schedules 
SET assigned_driver = NULL
WHERE assigned_driver = 'driver';

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_driver_guide ON product_schedules(assigned_guide_driver_guide);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_driver_driver ON product_schedules(assigned_guide_driver_driver);

-- 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND column_name LIKE '%assigned%'
ORDER BY ordinal_position;

-- 데이터 확인
SELECT 
    id,
    guide_assignment_type,
    assigned_guide_1,
    assigned_guide_2,
    assigned_driver,
    assigned_guide_driver_guide,
    assigned_guide_driver_driver
FROM product_schedules 
WHERE assigned_guide_1 IS NOT NULL 
   OR assigned_guide_2 IS NOT NULL 
   OR assigned_driver IS NOT NULL
   OR assigned_guide_driver_guide IS NOT NULL
   OR assigned_guide_driver_driver IS NOT NULL
LIMIT 10;
