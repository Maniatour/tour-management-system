-- 수량 기반 다중 선택 숙박 초이스 시스템 구현
-- 기존 상품에 다중 선택 가능한 숙박 초이스 추가

-- 1. 숙박 투어 상품에 수량 기반 다중 선택 choices 추가
-- 예시 상품 ID를 'ACCOMMODATION_TOUR'로 가정 (실제 상품 ID로 변경 필요)

UPDATE products 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'accommodation_choice',
      'name', 'Accommodation Choice',
      'name_ko', '숙박 선택',
      'type', 'multiple_quantity', -- 다중 선택 + 수량 지정
      'description', '필요한 숙박 타입과 수량을 선택하세요. 총 수용 인원이 예약 인원과 일치해야 합니다.',
      'validation', jsonb_build_object(
        'min_selections', 1,
        'max_selections', 10,
        'require_capacity_match', true
      ),
      'options', jsonb_build_array(
        jsonb_build_object(
          'id', 'single_room',
          'name', '1인 1실',
          'name_ko', '1인 1실',
          'adult_price', 50000,
          'child_price', 30000,
          'infant_price', 0,
          'capacity_per_room', 1,
          'max_quantity', 20,
          'description', '1인용 개별 객실'
        ),
        jsonb_build_object(
          'id', 'double_room',
          'name', '2인 1실', 
          'name_ko', '2인 1실',
          'adult_price', 80000,
          'child_price', 50000,
          'infant_price', 0,
          'capacity_per_room', 2,
          'max_quantity', 20,
          'description', '2인용 더블/트윈 객실'
        ),
        jsonb_build_object(
          'id', 'triple_room',
          'name', '3인 1실',
          'name_ko', '3인 1실', 
          'adult_price', 120000,
          'child_price', 80000,
          'infant_price', 0,
          'capacity_per_room', 3,
          'max_quantity', 20,
          'description', '3인용 트리플 객실'
        ),
        jsonb_build_object(
          'id', 'quad_room',
          'name', '4인 1실',
          'name_ko', '4인 1실',
          'adult_price', 150000,
          'child_price', 100000,
          'infant_price', 0,
          'capacity_per_room', 4,
          'max_quantity', 20,
          'description', '4인용 패밀리 객실'
        )
      )
    )
  )
)
WHERE id = 'ACCOMMODATION_TOUR'; -- 실제 숙박 투어 상품 ID로 변경

-- 2. 기존 상품이 없는 경우를 위한 샘플 상품 생성 (필요시)
INSERT INTO products (
  id, 
  name, 
  name_ko, 
  category, 
  sub_category, 
  description, 
  base_price,
  choices
) VALUES (
  'ACCOMMODATION_TOUR',
  'Accommodation Tour',
  '숙박 투어',
  'Accommodation',
  'Multi-day',
  '숙박이 포함된 투어 상품',
  0,
  jsonb_build_object(
    'required', jsonb_build_array(
      jsonb_build_object(
        'id', 'accommodation_choice',
        'name', 'Accommodation Choice',
        'name_ko', '숙박 선택',
        'type', 'multiple_quantity',
        'description', '필요한 숙박 타입과 수량을 선택하세요',
        'validation', jsonb_build_object(
          'min_selections', 1,
          'max_selections', 10,
          'require_capacity_match', true
        ),
        'options', jsonb_build_array(
          jsonb_build_object(
            'id', 'single_room',
            'name', '1인 1실',
            'name_ko', '1인 1실',
            'adult_price', 50000,
            'child_price', 30000,
            'infant_price', 0,
            'capacity_per_room', 1,
            'max_quantity', 20
          ),
          jsonb_build_object(
            'id', 'double_room',
            'name', '2인 1실', 
            'name_ko', '2인 1실',
            'adult_price', 80000,
            'child_price', 50000,
            'infant_price', 0,
            'capacity_per_room', 2,
            'max_quantity', 20
          ),
          jsonb_build_object(
            'id', 'triple_room',
            'name', '3인 1실',
            'name_ko', '3인 1실', 
            'adult_price', 120000,
            'child_price', 80000,
            'infant_price', 0,
            'capacity_per_room', 3,
            'max_quantity', 20
          ),
          jsonb_build_object(
            'id', 'quad_room',
            'name', '4인 1실',
            'name_ko', '4인 1실',
            'adult_price', 150000,
            'child_price', 100000,
            'infant_price', 0,
            'capacity_per_room', 4,
            'max_quantity', 20
          )
        )
      )
    )
  )
) ON CONFLICT (id) DO NOTHING;

-- 3. product_choices_view 업데이트 (다중 선택 지원)
-- 기존 뷰 삭제 후 재생성
DROP VIEW IF EXISTS product_choices_view;

CREATE VIEW product_choices_view AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.choices,
    choice_item->>'id' as choice_id,
    choice_item->>'name' as choice_name,
    choice_item->>'name_ko' as choice_name_ko,
    choice_item->>'type' as choice_type,
    choice_item->>'description' as choice_description,
    choice_item->'validation' as choice_validation,
    choice_option->>'id' as option_id,
    choice_option->>'name' as option_name,
    choice_option->>'name_ko' as option_name_ko,
    (choice_option->>'adult_price')::numeric as adult_price,
    (choice_option->>'child_price')::numeric as child_price,
    (choice_option->>'infant_price')::numeric as infant_price,
    (choice_option->>'capacity_per_room')::integer as capacity_per_room,
    (choice_option->>'max_quantity')::integer as max_quantity,
    (choice_option->>'is_default')::boolean as is_default,
    choice_option->>'description' as option_description
FROM products p,
     jsonb_array_elements(p.choices->'required') as choice_item,
     jsonb_array_elements(choice_item->'options') as choice_option
WHERE p.choices IS NOT NULL;

-- 4. 수량 기반 선택을 위한 헬퍼 함수 생성
CREATE OR REPLACE FUNCTION calculate_accommodation_total(
  selections JSONB,
  adults INTEGER,
  children INTEGER,
  infants INTEGER
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_price DECIMAL(10,2) := 0;
  selection JSONB;
  option JSONB;
  quantity INTEGER;
  adult_price DECIMAL(10,2);
  child_price DECIMAL(10,2);
  infant_price DECIMAL(10,2);
BEGIN
  -- 각 선택된 옵션에 대해 가격 계산
  FOR selection IN SELECT jsonb_array_elements(selections)
  LOOP
    -- 선택된 옵션의 수량과 가격 정보 가져오기
    quantity := (selection->>'quantity')::INTEGER;
    option := selection->'option';
    
    adult_price := (option->>'adult_price')::DECIMAL(10,2);
    child_price := (option->>'child_price')::DECIMAL(10,2);
    infant_price := (option->>'infant_price')::DECIMAL(10,2);
    
    -- 수량 * (성인가격 + 아동가격 + 유아가격)
    total_price := total_price + (quantity * (
      adult_price * adults + 
      child_price * children + 
      infant_price * infants
    ));
  END LOOP;
  
  RETURN total_price;
END;
$$ LANGUAGE plpgsql;

-- 5. 수용 인원 검증 함수 생성
CREATE OR REPLACE FUNCTION validate_accommodation_capacity(
  selections JSONB,
  total_people INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  total_capacity INTEGER := 0;
  selection JSONB;
  option JSONB;
  quantity INTEGER;
  capacity_per_room INTEGER;
BEGIN
  -- 각 선택된 옵션의 총 수용 인원 계산
  FOR selection IN SELECT jsonb_array_elements(selections)
  LOOP
    quantity := (selection->>'quantity')::INTEGER;
    option := selection->'option';
    capacity_per_room := (option->>'capacity_per_room')::INTEGER;
    
    total_capacity := total_capacity + (quantity * capacity_per_room);
  END LOOP;
  
  -- 총 수용 인원이 예약 인원과 일치하는지 확인
  RETURN total_capacity >= total_people;
END;
$$ LANGUAGE plpgsql;

-- 6. 테스트용 데이터 확인
SELECT 
  id,
  name,
  choices->'required'->0->>'type' as choice_type,
  jsonb_array_length(choices->'required'->0->'options') as option_count
FROM products 
WHERE id = 'ACCOMMODATION_TOUR';
