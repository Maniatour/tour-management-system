-- product_schedules 테이블에 구글맵 링크 컬럼 추가
-- 스케줄 항목에 구글맵 링크를 저장할 수 있도록 함

ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_schedules_google_maps_link ON product_schedules(google_maps_link) WHERE google_maps_link IS NOT NULL;
