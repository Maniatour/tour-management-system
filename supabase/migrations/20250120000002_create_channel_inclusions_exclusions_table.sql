-- dynamic_pricing 테이블에 포함/불포함 사항 컬럼 추가
-- 채널별로 다른 포함/불포함 사항을 저장할 수 있도록 함

-- 한국어 포함/불포함 사항 컬럼 추가
ALTER TABLE dynamic_pricing 
  ADD COLUMN IF NOT EXISTS inclusions_ko TEXT,
  ADD COLUMN IF NOT EXISTS exclusions_ko TEXT;

-- 영어 포함/불포함 사항 컬럼 추가
ALTER TABLE dynamic_pricing 
  ADD COLUMN IF NOT EXISTS inclusions_en TEXT,
  ADD COLUMN IF NOT EXISTS exclusions_en TEXT;

-- 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN dynamic_pricing.inclusions_ko IS '포함 사항 (한국어)';
COMMENT ON COLUMN dynamic_pricing.exclusions_ko IS '불포함 사항 (한국어)';
COMMENT ON COLUMN dynamic_pricing.inclusions_en IS '포함 사항 (영어)';
COMMENT ON COLUMN dynamic_pricing.exclusions_en IS '불포함 사항 (영어)';
