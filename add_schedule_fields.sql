-- product_schedules 테이블에 새로운 필드들 추가
-- 투어 스케줄과 가이드 스케줄을 복합적으로 관리하기 위한 컬럼들

-- 위치 정보 필드
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

-- 고객 표시 여부 필드
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS show_to_customers BOOLEAN DEFAULT true;

-- 가이드 할당 관련 필드들
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

-- 외래키 제약조건 추가 (선택사항 - 팀 테이블과 연결)
-- ALTER TABLE product_schedules 
-- ADD CONSTRAINT fk_assigned_guide_1 
-- FOREIGN KEY (assigned_guide_1) REFERENCES team(email);

-- ALTER TABLE product_schedules 
-- ADD CONSTRAINT fk_assigned_guide_2 
-- FOREIGN KEY (assigned_guide_2) REFERENCES team(email);

-- ALTER TABLE product_schedules 
-- ADD CONSTRAINT fk_assigned_driver 
-- FOREIGN KEY (assigned_driver) REFERENCES team(email);

-- 테이블 구조 확인
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
ORDER BY ordinal_position;
