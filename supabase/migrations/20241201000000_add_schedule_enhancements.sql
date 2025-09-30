-- Supabase Migration: Add enhanced schedule fields to product_schedules
-- Migration ID: 20241201_add_schedule_enhancements

-- 위치 정보 필드 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- 다국어 지원 필드들 (한국어/영어)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS title_ko VARCHAR(255),
ADD COLUMN IF NOT EXISTS title_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS description_ko TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT,
ADD COLUMN IF NOT EXISTS location_ko VARCHAR(255),
ADD COLUMN IF NOT EXISTS location_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS transport_details_ko VARCHAR(255),
ADD COLUMN IF NOT EXISTS transport_details_en VARCHAR(255),
ADD COLUMN IF NOT EXISTS notes_ko TEXT,
ADD COLUMN IF NOT EXISTS notes_en TEXT,
ADD COLUMN IF NOT EXISTS guide_notes_ko TEXT,
ADD COLUMN IF NOT EXISTS guide_notes_en TEXT;

-- 고객 표시 여부 필드 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS show_to_customers BOOLEAN DEFAULT true;

-- 가이드 할당 관련 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS guide_assignment_type VARCHAR(20) DEFAULT 'none' CHECK (guide_assignment_type IN ('none', 'single_guide', 'two_guides', 'guide_driver')),
ADD COLUMN IF NOT EXISTS assigned_guide_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_guide_2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS assigned_driver VARCHAR(255);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_show_to_customers ON product_schedules(show_to_customers);
CREATE INDEX IF NOT EXISTS idx_product_schedules_guide_assignment ON product_schedules(guide_assignment_type);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_1 ON product_schedules(assigned_guide_1);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_guide_2 ON product_schedules(assigned_guide_2);
CREATE INDEX IF NOT EXISTS idx_product_schedules_assigned_driver ON product_schedules(assigned_driver);

-- 기존 데이터에 대한 기본값 설정
UPDATE product_schedules 
SET show_to_customers = true 
WHERE show_to_customers IS NULL;

UPDATE product_schedules 
SET guide_assignment_type = 'none' 
WHERE guide_assignment_type IS NULL;

-- RLS 정책 업데이트 (필요한 경우)
-- 기존 RLS 정책이 있다면 새로운 컬럼들도 포함하도록 업데이트

-- 테이블 구조 확인을 위한 주석
-- 새로운 컬럼들:
-- - latitude: 위도 (DECIMAL(10, 8))
-- - longitude: 경도 (DECIMAL(11, 8))  
-- - show_to_customers: 고객에게 표시 여부 (BOOLEAN, 기본값 true)
-- - guide_assignment_type: 가이드 할당 유형 (VARCHAR(20), 기본값 'none')
-- - assigned_guide_1: 할당된 가이드 1 (VARCHAR(255))
-- - assigned_guide_2: 할당된 가이드 2 (VARCHAR(255))
-- - assigned_driver: 할당된 드라이버 (VARCHAR(255))
-- - guide_notes: 가이드 메모 (TEXT)
