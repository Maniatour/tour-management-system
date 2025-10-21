-- 기존 product_options 테이블을 활용한 간결한 초이스 시스템
-- Choices: 필수 선택 (숙박 타입 등)
-- Options: 선택적 추가 상품 (보험, 식사 등)

-- 1. 기존 복잡한 구조 제거
DROP VIEW IF EXISTS product_choices_view;

-- 2. 기존 product_options 테이블 구조 확인 및 개선
-- product_options는 이미 잘 설계되어 있음 (선택적 추가 상품용)

-- 3. Choices용 간단한 테이블 생성 (필수 선택만)
CREATE TABLE IF NOT EXISTS product_choices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  choice_name TEXT NOT NULL, -- 예: '숙박 선택'
  choice_name_ko TEXT NOT NULL, -- 예: '숙박 선택'
  choice_type TEXT NOT NULL DEFAULT 'single', -- 'single', 'multiple', 'quantity'
  is_required BOOLEAN DEFAULT true, -- choices는 항상 필수
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, choice_name)
);

-- 4. Choice 옵션 테이블 (choices의 세부 옵션)
CREATE TABLE IF NOT EXISTS choice_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  choice_id UUID REFERENCES product_choices(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL, -- 예: 'single_room', 'double_room'
  option_name TEXT NOT NULL, -- 예: 'Single Room'
  option_name_ko TEXT NOT NULL, -- 예: '1인 1실'
  adult_price DECIMAL(10,2) DEFAULT 0,
  child_price DECIMAL(10,2) DEFAULT 0,
  infant_price DECIMAL(10,2) DEFAULT 0,
  capacity INTEGER DEFAULT 1, -- 수용 인원
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(choice_id, option_key)
);

-- 5. 예약 선택사항 테이블 (choices + options 모두 포함)
CREATE TABLE IF NOT EXISTS reservation_selections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
  selection_type TEXT NOT NULL, -- 'choice' 또는 'option'
  choice_id UUID REFERENCES product_choices(id) ON DELETE CASCADE, -- choice인 경우
  option_id UUID REFERENCES product_options(id) ON DELETE CASCADE, -- option인 경우
  choice_option_id UUID REFERENCES choice_options(id) ON DELETE CASCADE, -- choice의 세부 옵션인 경우
  quantity INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- choice와 option 중 하나만 있어야 함
  CONSTRAINT check_selection_type CHECK (
    (selection_type = 'choice' AND choice_id IS NOT NULL AND choice_option_id IS NOT NULL AND option_id IS NULL) OR
    (selection_type = 'option' AND option_id IS NOT NULL AND choice_id IS NULL AND choice_option_id IS NULL)
  )
);

-- 6. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_choices_product_id ON product_choices(product_id);
CREATE INDEX IF NOT EXISTS idx_choice_options_choice_id ON choice_options(choice_id);
CREATE INDEX IF NOT EXISTS idx_reservation_selections_reservation_id ON reservation_selections(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_selections_type ON reservation_selections(selection_type);

-- 7. RLS 정책 설정 (현재 프로젝트는 팀 기반 접근 제어 미사용)
-- 필요시 나중에 활성화할 수 있도록 주석 처리
-- ALTER TABLE product_choices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE choice_options ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reservation_selections ENABLE ROW LEVEL SECURITY;

-- 팀 기반 접근 정책 (현재는 비활성화)
-- CREATE POLICY "product_choices_team_access" ON product_choices
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- CREATE POLICY "choice_options_team_access" ON choice_options
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- CREATE POLICY "reservation_selections_team_access" ON reservation_selections
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- 8. 편의 함수들
-- 예약의 모든 선택사항을 JSON으로 반환
CREATE OR REPLACE FUNCTION get_reservation_selections_json(reservation_id_param TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  selection_record RECORD;
BEGIN
  FOR selection_record IN
    SELECT 
      rs.selection_type,
      rs.quantity,
      rs.total_price,
      -- Choice 정보
      pc.choice_name,
      pc.choice_name_ko,
      pc.choice_type,
      co.option_key,
      co.option_name,
      co.option_name_ko,
      co.capacity,
      -- Option 정보
      po.name as option_name,
      po.description as option_description,
      po.adult_price_adjustment,
      po.child_price_adjustment,
      po.infant_price_adjustment
    FROM reservation_selections rs
    LEFT JOIN product_choices pc ON rs.choice_id = pc.id
    LEFT JOIN choice_options co ON rs.choice_option_id = co.id
    LEFT JOIN product_options po ON rs.option_id = po.id
    WHERE rs.reservation_id = reservation_id_param
    ORDER BY rs.selection_type, rs.created_at
  LOOP
    IF selection_record.selection_type = 'choice' THEN
      -- Choice 그룹별로 그룹화
      IF NOT result ? 'choices' THEN
        result := result || jsonb_build_object('choices', '{}'::jsonb);
      END IF;
      
      IF NOT result -> 'choices' ? selection_record.choice_name THEN
        result := jsonb_set(
          result,
          ARRAY['choices', selection_record.choice_name],
          jsonb_build_object(
            'name', selection_record.choice_name_ko,
            'type', selection_record.choice_type,
            'selections', '[]'::jsonb
          )
        );
      END IF;
      
      -- 선택사항 추가
      result := jsonb_set(
        result,
        ARRAY['choices', selection_record.choice_name, 'selections'],
        (
          result -> 'choices' -> selection_record.choice_name -> 'selections'
        ) || jsonb_build_object(
          'option_key', selection_record.option_key,
          'option_name', selection_record.option_name_ko,
          'quantity', selection_record.quantity,
          'total_price', selection_record.total_price,
          'capacity', selection_record.capacity
        )
      );
      
    ELSIF selection_record.selection_type = 'option' THEN
      -- Option 그룹별로 그룹화
      IF NOT result ? 'options' THEN
        result := result || jsonb_build_object('options', '[]'::jsonb);
      END IF;
      
      result := jsonb_set(
        result,
        ARRAY['options'],
        (
          result -> 'options'
        ) || jsonb_build_object(
          'name', selection_record.option_name,
          'description', selection_record.option_description,
          'quantity', selection_record.quantity,
          'total_price', selection_record.total_price,
          'adult_price_adjustment', selection_record.adult_price_adjustment,
          'child_price_adjustment', selection_record.child_price_adjustment,
          'infant_price_adjustment', selection_record.infant_price_adjustment
        )
      );
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 예약 선택사항 총 가격 계산
CREATE OR REPLACE FUNCTION calculate_reservation_selections_total(reservation_id_param TEXT)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total DECIMAL(10,2) := 0;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO total
  FROM reservation_selections
  WHERE reservation_id = reservation_id_param;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 9. 샘플 데이터 생성
-- 숙박 투어 상품에 대한 choice 설정
INSERT INTO product_choices (
  product_id,
  choice_name,
  choice_name_ko,
  choice_type,
  min_selections,
  max_selections,
  sort_order
) VALUES (
  'ACCOMMODATION_TOUR',
  'accommodation',
  '숙박',
  'quantity',
  1,
  10,
  1
) ON CONFLICT (product_id, choice_name) DO NOTHING;

-- 숙박 옵션들
INSERT INTO choice_options (
  choice_id,
  option_key,
  option_name,
  option_name_ko,
  adult_price,
  child_price,
  infant_price,
  capacity,
  sort_order
) VALUES 
  (
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_name = 'accommodation'),
    'single_room',
    'Single Room',
    '1인 1실',
    50000,
    30000,
    0,
    1,
    1
  ),
  (
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_name = 'accommodation'),
    'double_room',
    'Double Room',
    '2인 1실',
    80000,
    50000,
    0,
    2,
    2
  ),
  (
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_name = 'accommodation'),
    'triple_room',
    'Triple Room',
    '3인 1실',
    120000,
    80000,
    0,
    3,
    3
  ),
  (
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_name = 'accommodation'),
    'quad_room',
    'Quad Room',
    '4인 1실',
    150000,
    100000,
    0,
    4,
    4
  )
ON CONFLICT (choice_id, option_key) DO NOTHING;

-- 샘플 추가 상품 옵션 (기존 product_options 테이블 사용)
INSERT INTO product_options (
  product_id,
  name,
  description,
  is_required,
  is_multiple,
  choice_name,
  choice_description,
  adult_price_adjustment,
  child_price_adjustment,
  infant_price_adjustment,
  is_default
) VALUES 
  (
    'ACCOMMODATION_TOUR',
    'Travel Insurance',
    '여행자 보험',
    false,
    false,
    '보험',
    '여행자 보험을 추가하시겠습니까?',
    15000,
    10000,
    5000,
    false
  ),
  (
    'ACCOMMODATION_TOUR',
    'Airport Transfer',
    '공항 픽업 서비스',
    false,
    false,
    '교통',
    '공항 픽업 서비스를 추가하시겠습니까?',
    30000,
    20000,
    0,
    false
  ),
  (
    'ACCOMMODATION_TOUR',
    'Breakfast',
    '조식',
    false,
    true,
    '식사',
    '조식을 추가하시겠습니까?',
    15000,
    10000,
    0,
    false
  )
ON CONFLICT DO NOTHING;

-- 10. 뷰 생성 (편의를 위해)
CREATE VIEW reservation_selections_view AS
SELECT 
  rs.id,
  rs.reservation_id,
  rs.selection_type,
  rs.quantity,
  rs.total_price,
  -- Choice 정보
  pc.choice_name,
  pc.choice_name_ko,
  pc.choice_type,
  co.option_key,
  co.option_name,
  co.option_name_ko,
  co.capacity,
  -- Option 정보
  po.name as option_name,
  po.description as option_description,
  po.adult_price_adjustment,
  po.child_price_adjustment,
  po.infant_price_adjustment
FROM reservation_selections rs
LEFT JOIN product_choices pc ON rs.choice_id = pc.id
LEFT JOIN choice_options co ON rs.choice_option_id = co.id
LEFT JOIN product_options po ON rs.option_id = po.id
ORDER BY rs.selection_type, rs.created_at;
