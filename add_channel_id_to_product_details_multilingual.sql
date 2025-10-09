-- product_details_multilingual 테이블에 channel_id 컬럼 추가
-- 채널별로 다른 세부정보를 저장할 수 있도록 함

-- channel_id 컬럼 추가
ALTER TABLE product_details_multilingual 
  ADD COLUMN IF NOT EXISTS channel_id TEXT;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN product_details_multilingual.channel_id IS '채널 ID (NULL이면 전체 채널 공통)';

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_channel_id 
  ON product_details_multilingual (channel_id);

-- 복합 인덱스 추가 (product_id, channel_id, language_code)
CREATE INDEX IF NOT EXISTS idx_product_details_multilingual_product_channel_lang 
  ON product_details_multilingual (product_id, channel_id, language_code);

-- 기존 데이터의 channel_id를 NULL로 설정 (전체 채널 공통)
UPDATE product_details_multilingual 
  SET channel_id = NULL 
  WHERE channel_id IS NULL;
