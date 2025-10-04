-- product_schedules 테이블 완전한 마이그레이션 스크립트
-- 누락된 모든 컬럼을 추가합니다

-- 1. no_time 컬럼 추가 (시간 없음 체크박스)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS no_time BOOLEAN DEFAULT false;

-- 2. google_maps_link 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

-- 3. latitude 컬럼 추가 (위도)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8);

-- 4. longitude 컬럼 추가 (경도)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8);

-- 5. show_to_customers 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS show_to_customers BOOLEAN DEFAULT true;

-- 6. 제목 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS title_ko TEXT;
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS title_en TEXT;

-- 7. 설명 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS description_ko TEXT;
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 8. 위치 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS location_ko TEXT;
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS location_en TEXT;

-- 9. 가이드 노트 필드들 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS guide_notes_ko TEXT;
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS guide_notes_en TEXT;

-- 10. 썸네일 URL 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 11. 순서 인덱스 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS order_index INTEGER;

-- 12. 이중 가이드 스케줄 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS two_guide_schedule TEXT;

-- 13. 가이드/드라이버 스케줄 컬럼 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS guide_driver_schedule TEXT;

-- 14. 기존 데이터에 대한 기본값 설정
UPDATE product_schedules 
SET 
    no_time = COALESCE(no_time, false),
    show_to_customers = COALESCE(show_to_customers, true)
WHERE no_time IS NULL OR show_to_customers IS NULL;

-- 15. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_product_schedules_product_id ON product_schedules(product_id);
CREATE INDEX IF NOT EXISTS idx_product_schedules_day_number ON product_schedules(product_id, day_number);
CREATE INDEX IF NOT EXISTS idx_product_schedules_order_index ON product_schedules(product_id, order_index);

-- 16. 외래키 제약조건 확인 (필요한 경우)
-- ALTER TABLE product_schedules 
-- ADD CONSTRAINT fk_product_schedules_product_id 
-- FOREIGN KEY (product_id) REFERENCES products(id) 
-- ON DELETE CASCADE;

-- 17. 컬럼 코멘트 추가
COMMENT ON COLUMN product_schedules.no_time IS '시간 없음 체크박스 여부';
COMMENT ON COLUMN product_schedules.google_maps_link IS 'Google Maps 링크 URL';
COMMENT ON COLUMN product_schedules.latitude IS '위도 좌표';
COMMENT ON COLUMN product_schedules.longitude IS '경도 좌표';
COMMENT ON COLUMN product_schedules.show_to_customers IS '고객에게 표시 여부';
COMMENT ON COLUMN product_schedules.title_ko IS '일정 제목 (한국어)';
COMMENT ON COLUMN product_schedules.title_en IS '일정 제목 (영어)';
COMMENT ON COLUMN product_schedules.description_ko IS '일정 설명 (한국어)';
COMMENT ON COLUMN product_schedules.description_en IS '일정 설명 (영어)';
COMMENT ON COLUMN product_schedules.location_ko IS '위치 정보 (한국어)';
COMMENT ON COLUMN product_schedules.location_en IS '위치 정보 (영어)';
COMMENT ON COLUMN product_schedules.guide_notes_ko IS '가이드 노트 (한국어)';
COMMENT ON COLUMN product_schedules.guide_notes_en IS '가이드 노트 (영어)';
COMMENT ON COLUMN product_schedules.thumbnail_url IS '썸네일 이미지 URL';
COMMENT ON COLUMN product_schedules.order_index IS '순서 인덱스';
COMMENT ON COLUMN product_schedules.two_guide_schedule IS '이중 가이드 스케줄';
COMMENT ON COLUMN product_schedules.guide_driver_schedule IS '가이드/드라이버 스케줄';

-- 18. 수정 완료 후 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 성공 메시지
SELECT 'product_schedules 테이블 마이그레이션 완료' as status;
