-- 투어 코스 테이블에 distance 필드 추가
-- 거리 정보를 킬로미터 단위로 저장

-- tour_courses 테이블에 distance 필드 추가
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS distance DECIMAL(10, 2); -- 거리 (킬로미터)

-- distance 필드에 대한 코멘트 추가
COMMENT ON COLUMN tour_courses.distance IS '투어 코스의 총 거리 (킬로미터 단위)';

-- 기존 데이터에 대한 기본값 설정 (필요시)
-- UPDATE tour_courses SET distance = 0 WHERE distance IS NULL;

-- 인덱스 생성 (선택사항 - 거리별 검색이 필요한 경우)
-- CREATE INDEX IF NOT EXISTS idx_tour_courses_distance ON tour_courses(distance);
