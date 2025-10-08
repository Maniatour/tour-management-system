-- 픽업 호텔 테이블에 YouTube 링크 컬럼 추가
ALTER TABLE pickup_hotels 
ADD COLUMN IF NOT EXISTS youtube_link TEXT;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN pickup_hotels.youtube_link IS 'YouTube 링크 (호텔 소개 영상 등)';

-- 인덱스 생성 (선택사항 - YouTube 링크로 검색할 경우)
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_youtube_link ON pickup_hotels(youtube_link) WHERE youtube_link IS NOT NULL;
