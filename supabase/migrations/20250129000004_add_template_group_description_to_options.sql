-- options 테이블에 template_group_description_ko, template_group_description_en 컬럼 추가
-- 초이스 템플릿 그룹의 한글 설명과 영문 설명을 저장하기 위한 컬럼

-- 1. template_group_description_ko 컬럼 추가 (한글 설명)
ALTER TABLE options 
ADD COLUMN IF NOT EXISTS template_group_description_ko TEXT;

-- 2. template_group_description_en 컬럼 추가 (영문 설명)
ALTER TABLE options 
ADD COLUMN IF NOT EXISTS template_group_description_en TEXT;

-- 3. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN options.template_group_description_ko IS '초이스 템플릿 그룹 설명 (한국어)';
COMMENT ON COLUMN options.template_group_description_en IS '초이스 템플릿 그룹 설명 (영어)';

