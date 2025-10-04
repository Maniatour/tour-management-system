-- product_schedules 테이블에 누락된 컬럼들 추가

-- 1. no_time 컬럼 추가 (시간 없음 체크박스)
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS no_time BOOLEAN DEFAULT false;

-- 2. 다른 필요한 컬럼들도 확인하고 추가
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS google_maps_link TEXT;

-- 3. thumbnail_url 컬럼이 있다면 제약조건 확인
-- ALTER TABLE product_schedules ALTER COLUMN thumbnail_url DROP NOT NULL IF EXISTS;

-- 4. 컬럼들에 코멘트 추가
COMMENT ON COLUMN product_schedules.no_time IS '시간 없음 체크박스 여부';
COMMENT ON COLUMN product_schedules.google_maps_link IS 'Google Maps 링크 URL';

-- 5. 기존 데이터에 대한 기본값 설정
UPDATE product_schedules 
SET no_time = false 
WHERE no_time IS NULL;

-- 6. 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND table_schema = 'public'
ORDER BY ordinal_position;
