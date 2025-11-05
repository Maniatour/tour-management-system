-- product_details_multilingual 테이블의 unique constraint 업데이트
-- channel_id를 포함하여 (product_id, language_code, channel_id) 조합이 unique하도록 변경
-- channel_id가 NULL인 경우도 하나만 허용

-- 기존 unique constraint 제거
ALTER TABLE product_details_multilingual 
  DROP CONSTRAINT IF EXISTS product_details_multilingual_product_id_language_code_key;

-- 부분 unique index를 사용하여 channel_id가 NULL인 경우와 아닌 경우를 별도 처리
-- channel_id가 NOT NULL인 경우: (product_id, language_code, channel_id) 조합이 unique
CREATE UNIQUE INDEX IF NOT EXISTS product_details_multilingual_product_lang_channel_unique 
  ON product_details_multilingual (product_id, language_code, channel_id)
  WHERE channel_id IS NOT NULL;

-- channel_id가 NULL인 경우: (product_id, language_code) 조합이 하나만 허용
CREATE UNIQUE INDEX IF NOT EXISTS product_details_multilingual_product_lang_null_unique 
  ON product_details_multilingual (product_id, language_code)
  WHERE channel_id IS NULL;

-- 기존 인덱스는 유지 (성능 최적화)
-- 복합 인덱스는 이미 존재함 (idx_product_details_multilingual_product_channel_lang)

COMMENT ON INDEX product_details_multilingual_product_lang_channel_unique IS 
  'channel_id가 NULL이 아닌 경우 (product_id, language_code, channel_id) 조합이 unique';
COMMENT ON INDEX product_details_multilingual_product_lang_null_unique IS 
  'channel_id가 NULL인 경우 (product_id, language_code) 조합이 하나만 허용';

