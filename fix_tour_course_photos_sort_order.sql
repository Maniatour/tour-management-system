-- tour_course_photos 테이블에 sort_order 컬럼 추가
ALTER TABLE tour_course_photos 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- sort_order 인덱스 생성 (이미 존재할 수 있음)
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);

-- 기존 데이터의 sort_order 업데이트 (NULL인 경우 0으로 설정)
UPDATE tour_course_photos 
SET sort_order = 0 
WHERE sort_order IS NULL;
