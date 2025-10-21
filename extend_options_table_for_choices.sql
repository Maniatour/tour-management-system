-- 기존 옵션 테이블을 확장하여 초이스 템플릿 기능 추가
-- 별도 테이블 대신 기존 구조 활용

-- 1. 기존 options 테이블에 초이스 관련 컬럼 추가
ALTER TABLE options ADD COLUMN IF NOT EXISTS name_ko TEXT; -- 한글 이름 추가
ALTER TABLE options ADD COLUMN IF NOT EXISTS is_choice_template BOOLEAN DEFAULT false;
ALTER TABLE options ADD COLUMN IF NOT EXISTS choice_type TEXT DEFAULT 'single'; -- 'single', 'multiple', 'quantity'
ALTER TABLE options ADD COLUMN IF NOT EXISTS min_selections INTEGER DEFAULT 1;
ALTER TABLE options ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;
ALTER TABLE options ADD COLUMN IF NOT EXISTS template_group TEXT; -- 템플릿 그룹명 (예: '숙박 선택', '교통 선택')
ALTER TABLE options ADD COLUMN IF NOT EXISTS template_group_ko TEXT; -- 템플릿 그룹명 한글
ALTER TABLE options ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true; -- 필수 선택 여부
ALTER TABLE options ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0; -- 정렬 순서

-- 2. 초이스 타입 제약 조건 추가
ALTER TABLE options ADD CONSTRAINT check_choice_type 
  CHECK (choice_type IN ('single', 'multiple', 'quantity'));

-- 3. 초이스 템플릿용 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_options_is_choice_template ON options(is_choice_template);
CREATE INDEX IF NOT EXISTS idx_options_template_group ON options(template_group);
CREATE INDEX IF NOT EXISTS idx_options_choice_type ON options(choice_type);

-- 4. 기존 데이터를 초이스 템플릿으로 변환 (선택사항)
-- 예시: 기존 옵션 중 일부를 초이스 템플릿으로 설정
UPDATE options 
SET 
  name_ko = CASE 
    WHEN name LIKE '%Room%' THEN '객실'
    WHEN name LIKE '%Hotel%' THEN '호텔'
    ELSE name
  END,
  is_choice_template = true,
  choice_type = 'single',
  template_group = 'Accommodation',
  template_group_ko = '숙박 선택',
  is_required = true
WHERE category = 'accommodation';

UPDATE options 
SET 
  name_ko = CASE 
    WHEN name LIKE '%Breakfast%' THEN '아침식사'
    WHEN name LIKE '%Lunch%' THEN '점심식사'
    WHEN name LIKE '%Dinner%' THEN '저녁식사'
    ELSE name
  END,
  is_choice_template = true,
  choice_type = 'multiple',
  template_group = 'Meal',
  template_group_ko = '식사 선택',
  is_required = false
WHERE category = 'meal';

UPDATE options 
SET 
  name_ko = CASE 
    WHEN name LIKE '%Bus%' THEN '버스'
    WHEN name LIKE '%Van%' THEN '밴'
    WHEN name LIKE '%Car%' THEN '자동차'
    ELSE name
  END,
  is_choice_template = true,
  choice_type = 'single',
  template_group = 'Transportation',
  template_group_ko = '교통 선택',
  is_required = true
WHERE category = 'transportation';

-- 5. 상품별 초이스 템플릿 연결 테이블 (기존 product_options 활용)
-- product_options 테이블에 초이스 관련 컬럼 추가
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS is_from_template BOOLEAN DEFAULT false;
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS template_option_id TEXT REFERENCES options(id); -- 원본 템플릿 옵션 ID
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS choice_type TEXT DEFAULT 'single';
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS min_selections INTEGER DEFAULT 1;
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;
ALTER TABLE product_options ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT true;

-- 6. 초이스 템플릿 조회 뷰 생성
CREATE OR REPLACE VIEW choice_templates AS
SELECT 
  id,
  name,
  name_ko,
  description,
  category,
  adult_price,
  child_price,
  infant_price,
  price_type,
  status,
  tags,
  choice_type,
  min_selections,
  max_selections,
  template_group,
  template_group_ko,
  is_required,
  sort_order,
  created_at
FROM options 
WHERE is_choice_template = true
ORDER BY template_group, sort_order, name;

-- 7. 샘플 초이스 템플릿 데이터 추가
INSERT INTO options (
  id, name, name_ko, description, category, adult_price, child_price, infant_price, 
  price_type, status, tags, is_choice_template, choice_type, min_selections, 
  max_selections, template_group, template_group_ko, is_required, sort_order
) VALUES
-- 숙박 선택 템플릿
('choice-accommodation-single', 'Single Room', '1인 1실', '1인용 객실', 'accommodation', 0, 0, 0, 'per_person', 'active', ARRAY['숙박', 'accommodation'], true, 'single', 1, 1, 'Accommodation', '숙박 선택', true, 1),
('choice-accommodation-double', 'Double Room', '2인 1실', '2인용 객실', 'accommodation', 50, 25, 0, 'per_person', 'active', ARRAY['숙박', 'accommodation'], true, 'single', 1, 1, 'Accommodation', '숙박 선택', true, 2),
('choice-accommodation-triple', 'Triple Room', '3인 1실', '3인용 객실', 'accommodation', 75, 37.5, 0, 'per_person', 'active', ARRAY['숙박', 'accommodation'], true, 'single', 1, 1, 'Accommodation', '숙박 선택', true, 3),

-- 교통 선택 템플릿
('choice-transportation-bus', 'Bus', '버스', '대형 버스', 'transportation', 0, 0, 0, 'per_person', 'active', ARRAY['교통', 'transportation'], true, 'single', 1, 1, 'Transportation', '교통 선택', true, 1),
('choice-transportation-van', 'Van', '밴', '소형 밴', 'transportation', 100, 50, 0, 'per_person', 'active', ARRAY['교통', 'transportation'], true, 'single', 1, 1, 'Transportation', '교통 선택', true, 2),

-- 식사 선택 템플릿
('choice-meal-breakfast', 'Breakfast', '아침식사', '아침 식사', 'meal', 25, 12.5, 0, 'per_person', 'active', ARRAY['식사', 'meal'], true, 'multiple', 0, 3, 'Meal', '식사 선택', false, 1),
('choice-meal-lunch', 'Lunch', '점심식사', '점심 식사', 'meal', 35, 17.5, 0, 'per_person', 'active', ARRAY['식사', 'meal'], true, 'multiple', 0, 3, 'Meal', '식사 선택', false, 2),
('choice-meal-dinner', 'Dinner', '저녁식사', '저녁 식사', 'meal', 45, 22.5, 0, 'per_person', 'active', ARRAY['식사', 'meal'], true, 'multiple', 0, 3, 'Meal', '식사 선택', false, 3),

-- 액티비티 선택 템플릿
('choice-activity-hiking', 'Hiking', '하이킹', '등산 활동', 'activity', 50, 25, 0, 'per_person', 'active', ARRAY['액티비티', 'activity'], true, 'quantity', 0, 5, 'Activity', '액티비티 선택', false, 1),
('choice-activity-swimming', 'Swimming', '수영', '수영 활동', 'activity', 30, 15, 0, 'per_person', 'active', ARRAY['액티비티', 'activity'], true, 'quantity', 0, 5, 'Activity', '액티비티 선택', false, 2);

-- 8. 초이스 템플릿 통계 쿼리
-- 템플릿 그룹별 통계
SELECT 
  template_group_ko,
  choice_type,
  COUNT(*) as option_count,
  MIN(adult_price) as min_price,
  MAX(adult_price) as max_price,
  AVG(adult_price) as avg_price
FROM options 
WHERE is_choice_template = true 
GROUP BY template_group_ko, choice_type
ORDER BY template_group_ko, choice_type;

-- 9. 상품에서 초이스 템플릿 사용 예시
-- 템플릿에서 상품 옵션으로 복사하는 함수 (예시)
CREATE OR REPLACE FUNCTION copy_template_to_product(
  p_product_id TEXT,
  p_template_group TEXT,
  p_is_required BOOLEAN DEFAULT true
) RETURNS INTEGER AS $$
DECLARE
  template_option RECORD;
  copied_count INTEGER := 0;
BEGIN
  -- 템플릿 그룹의 모든 옵션을 상품에 복사
  FOR template_option IN 
    SELECT * FROM options 
    WHERE is_choice_template = true 
    AND template_group = p_template_group
  LOOP
    INSERT INTO product_options (
      product_id, name, description, category,
      adult_price, child_price, infant_price, price_type, status, tags,
      is_from_template, template_option_id, choice_type, min_selections, 
      max_selections, is_required
    ) VALUES (
      p_product_id, template_option.name, 
      template_option.description, template_option.category,
      template_option.adult_price, template_option.child_price, 
      template_option.infant_price, template_option.price_type, 
      template_option.status, template_option.tags,
      true, template_option.id, template_option.choice_type, 
      template_option.min_selections, template_option.max_selections, 
      p_is_required
    );
    copied_count := copied_count + 1;
  END LOOP;
  
  RETURN copied_count;
END;
$$ LANGUAGE plpgsql;

-- 10. 사용 예시
-- 특정 상품에 숙박 선택 템플릿 적용
-- SELECT copy_template_to_product('PRODUCT_ID', 'Accommodation', true);
