-- product_choices 테이블에 description_ko, description_en 컬럼 추가
-- 초이스 그룹의 한글 설명과 영문 설명을 저장하기 위한 컬럼

-- 1. description_ko 컬럼 추가 (한글 설명)
ALTER TABLE product_choices 
ADD COLUMN IF NOT EXISTS description_ko TEXT;

-- 2. description_en 컬럼 추가 (영문 설명)
ALTER TABLE product_choices 
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- 3. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN product_choices.description_ko IS '초이스 그룹 설명 (한국어)';
COMMENT ON COLUMN product_choices.description_en IS '초이스 그룹 설명 (영어)';

