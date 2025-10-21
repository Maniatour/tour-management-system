-- 간결하고 확장 가능한 초이스 시스템 설계
-- 단일 테이블로 모든 초이스 타입을 처리할 수 있는 구조

-- 1. 기존 복잡한 구조 제거
DROP VIEW IF EXISTS product_choices_view;

-- 2. 새로운 간결한 초이스 테이블 생성
CREATE TABLE IF NOT EXISTS product_choices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE CASCADE,
  choice_group TEXT NOT NULL, -- 예: 'accommodation', 'transportation', 'meals'
  choice_group_ko TEXT NOT NULL, -- 예: '숙박', '교통', '식사'
  choice_type TEXT NOT NULL DEFAULT 'single', -- 'single', 'multiple', 'quantity'
  is_required BOOLEAN DEFAULT false,
  min_selections INTEGER DEFAULT 1,
  max_selections INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(product_id, choice_group)
);

-- 3. 초이스 옵션 테이블
CREATE TABLE IF NOT EXISTS choice_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  choice_id UUID REFERENCES product_choices(id) ON DELETE CASCADE,
  option_key TEXT NOT NULL, -- 예: 'single_room', 'double_room'
  option_name TEXT NOT NULL, -- 예: '1인 1실'
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

-- 4. 예약 초이스 선택 테이블 (정규화된 구조)
CREATE TABLE IF NOT EXISTS reservation_choices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
  choice_id UUID REFERENCES product_choices(id) ON DELETE CASCADE,
  option_id UUID REFERENCES choice_options(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  total_price DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(reservation_id, choice_id, option_id)
);

-- 5. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_choices_product_id ON product_choices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_choices_group ON product_choices(choice_group);
CREATE INDEX IF NOT EXISTS idx_choice_options_choice_id ON choice_options(choice_id);
CREATE INDEX IF NOT EXISTS idx_reservation_choices_reservation_id ON reservation_choices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_choices_choice_id ON reservation_choices(choice_id);

-- 6. RLS 정책 설정 (현재 프로젝트는 팀 기반 접근 제어 미사용)
-- 필요시 나중에 활성화할 수 있도록 주석 처리
-- ALTER TABLE product_choices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE choice_options ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reservation_choices ENABLE ROW LEVEL SECURITY;

-- 팀 기반 접근 정책 (현재는 비활성화)
-- CREATE POLICY "product_choices_team_access" ON product_choices
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- CREATE POLICY "choice_options_team_access" ON choice_options
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- CREATE POLICY "reservation_choices_team_access" ON reservation_choices
--   FOR ALL USING (true); -- 모든 사용자 접근 허용

-- 7. 편의 함수들
-- 예약의 모든 초이스 선택을 JSON으로 반환
CREATE OR REPLACE FUNCTION get_reservation_choices_json(reservation_id_param TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  choice_record RECORD;
BEGIN
  FOR choice_record IN
    SELECT 
      pc.choice_group,
      pc.choice_group_ko,
      pc.choice_type,
      pc.is_required,
      co.option_key,
      co.option_name,
      co.option_name_ko,
      rc.quantity,
      rc.total_price
    FROM reservation_choices rc
    JOIN product_choices pc ON rc.choice_id = pc.id
    JOIN choice_options co ON rc.option_id = co.id
    WHERE rc.reservation_id = reservation_id_param
    ORDER BY pc.sort_order, co.sort_order
  LOOP
    -- 그룹별로 그룹화
    IF NOT result ? choice_record.choice_group THEN
      result := result || jsonb_build_object(
        choice_record.choice_group,
        jsonb_build_object(
          'name', choice_record.choice_group_ko,
          'type', choice_record.choice_type,
          'required', choice_record.is_required,
          'selections', '[]'::jsonb
        )
      );
    END IF;
    
    -- 선택사항 추가
    result := jsonb_set(
      result,
      ARRAY[choice_record.choice_group, 'selections'],
      (
        result -> choice_record.choice_group -> 'selections'
      ) || jsonb_build_object(
        'option_key', choice_record.option_key,
        'option_name', choice_record.option_name,
        'option_name_ko', choice_record.option_name_ko,
        'quantity', choice_record.quantity,
        'total_price', choice_record.total_price
      )
    );
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 예약 초이스 총 가격 계산
CREATE OR REPLACE FUNCTION calculate_reservation_choices_total(reservation_id_param TEXT)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total DECIMAL(10,2) := 0;
BEGIN
  SELECT COALESCE(SUM(total_price), 0) INTO total
  FROM reservation_choices
  WHERE reservation_id = reservation_id_param;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- 8. 샘플 데이터 생성
-- 숙박 투어 상품에 대한 초이스 설정
INSERT INTO product_choices (
  product_id,
  choice_group,
  choice_group_ko,
  choice_type,
  is_required,
  min_selections,
  max_selections,
  sort_order
) VALUES (
  'ACCOMMODATION_TOUR',
  'accommodation',
  '숙박',
  'quantity',
  true,
  1,
  10,
  1
) ON CONFLICT (product_id, choice_group) DO NOTHING;

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
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_group = 'accommodation'),
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
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_group = 'accommodation'),
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
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_group = 'accommodation'),
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
    (SELECT id FROM product_choices WHERE product_id = 'ACCOMMODATION_TOUR' AND choice_group = 'accommodation'),
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

-- 9. 뷰 생성 (편의를 위해)
CREATE VIEW reservation_choices_view AS
SELECT 
  rc.id,
  rc.reservation_id,
  pc.choice_group,
  pc.choice_group_ko,
  pc.choice_type,
  pc.is_required,
  co.option_key,
  co.option_name,
  co.option_name_ko,
  co.adult_price,
  co.child_price,
  co.infant_price,
  co.capacity,
  rc.quantity,
  rc.total_price
FROM reservation_choices rc
JOIN product_choices pc ON rc.choice_id = pc.id
JOIN choice_options co ON rc.option_id = co.id
ORDER BY pc.sort_order, co.sort_order;
