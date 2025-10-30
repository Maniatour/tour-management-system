-- product_choices 테이블에 choice_group_en 컬럼 추가
-- 초이스 그룹명의 영어 버전을 저장하기 위한 컬럼

-- 1. choice_group_en 컬럼 추가 (NULL 허용, 기존 데이터와의 호환성을 위해)
ALTER TABLE product_choices 
ADD COLUMN IF NOT EXISTS choice_group_en TEXT;

-- 2. 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN product_choices.choice_group_en IS '초이스 그룹명 (영어)';

-- 3. (선택사항) 인덱스가 필요한 경우 아래 주석을 해제하세요
-- CREATE INDEX IF NOT EXISTS idx_product_choices_group_en ON product_choices(choice_group_en) WHERE choice_group_en IS NOT NULL;


