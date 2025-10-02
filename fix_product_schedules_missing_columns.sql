-- product_schedules 테이블에 누락된 컬럼들 추가
-- 가이드 할당 관련 필드들과 기타 필요한 필드들

-- 가이드 할당 관련 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS assigned_guide_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_guide_2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_guide_driver_guide VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_guide_driver_driver VARCHAR(255);

-- 기타 누락된 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS is_tour BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_guide_schedule TEXT,
ADD COLUMN IF NOT EXISTS guide_driver_schedule TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_1 ON product_schedules(assigned_guide_1);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_2 ON product_schedules(assigned_guide_2);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_driver_guide ON product_schedules(assigned_guide_driver_guide);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_driver_driver ON product_schedules(assigned_guide_driver_driver);
CREATE INDEX IF NOT EXISTS idx_product_schedules_is_tour ON product_schedules(is_tour);
CREATE INDEX IF NOT EXISTS idx_product_schedules_order_index ON product_schedules(order_index);

-- 완료 메시지
SELECT 'product_schedules 테이블에 누락된 컬럼들이 추가되었습니다.' as message;
