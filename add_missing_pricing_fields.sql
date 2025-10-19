-- 동적 가격 테이블에 누락된 필드 추가
-- not_included_price: 불포함 금액
-- markup_percent: 마크업 퍼센트

ALTER TABLE dynamic_pricing 
ADD COLUMN IF NOT EXISTS not_included_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_not_included ON dynamic_pricing(not_included_price);
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_markup_percent ON dynamic_pricing(markup_percent);

-- 기존 데이터에 기본값 설정
UPDATE dynamic_pricing 
SET not_included_price = 0, markup_percent = 0 
WHERE not_included_price IS NULL OR markup_percent IS NULL;

-- 컬럼에 NOT NULL 제약조건 추가
ALTER TABLE dynamic_pricing 
ALTER COLUMN not_included_price SET NOT NULL,
ALTER COLUMN markup_percent SET NOT NULL;

-- 변경사항 확인
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'dynamic_pricing' 
AND column_name IN ('not_included_price', 'markup_percent');
