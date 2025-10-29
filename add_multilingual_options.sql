-- 옵션 테이블에 다국어 지원 추가

-- 1. name_en 컬럼 추가
ALTER TABLE options ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);

-- 2. description을 description_ko로 백업 후 새로운 컬럼들 추가
ALTER TABLE options ADD COLUMN IF NOT EXISTS description_ko TEXT;
ALTER TABLE options ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 3. 기존 description 값을 description_ko로 복사
UPDATE options 
SET description_ko = description 
WHERE description IS NOT NULL AND description_ko IS NULL;

-- 4. name은 내부용으로 유지, description은 내부용으로 유지
COMMENT ON COLUMN options.name IS '내부용 옵션명';
COMMENT ON COLUMN options.description IS '내부용 설명';
COMMENT ON COLUMN options.name_ko IS '고객용 한글 옵션명';
COMMENT ON COLUMN options.name_en IS '고객용 영어 옵션명';
COMMENT ON COLUMN options.description_ko IS '고객용 한글 설명';
COMMENT ON COLUMN options.description_en IS '고객용 영어 설명';
