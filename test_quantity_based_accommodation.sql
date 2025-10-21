-- 수량 기반 다중 선택 숙박 초이스 시스템 테스트
-- 실제 상품 ID로 변경하여 사용하세요

-- 1. 테스트용 숙박 투어 상품 생성 (이미 있다면 건너뛰기)
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
  'ACCOMMODATION_TOUR_TEST',
  'Accommodation Tour Test',
  '숙박 투어 테스트',
  'Accommodation',
  'Multi-day',
  '수량 기반 다중 선택을 테스트하기 위한 숙박 투어 상품',
  0,
  jsonb_build_object(
    'required', jsonb_build_array(
      jsonb_build_object(
        'id', 'accommodation_choice',
        'name', 'Accommodation Choice',
        'name_ko', '숙박 선택',
        'type', 'multiple_quantity',
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
) ON CONFLICT (id) DO NOTHING;

-- 2. 테스트용 예약 생성 (5인 가족 예약)
INSERT INTO reservations (
  id,
  customer_id,
  product_id,
  tour_date,
  adults,
  child,
  infant,
  total_people,
  channel_id,
  status,
  choices
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM customers LIMIT 1), -- 첫 번째 고객 사용
  'ACCOMMODATION_TOUR_TEST',
  CURRENT_DATE + INTERVAL '7 days',
  4, -- 성인 4명
  1, -- 아동 1명
  0, -- 유아 0명
  5, -- 총 5명
  (SELECT id FROM channels LIMIT 1), -- 첫 번째 채널 사용
  'pending',
  jsonb_build_object(
    'required', jsonb_build_array(
      jsonb_build_object(
        'id', 'accommodation_choice',
        'selections', jsonb_build_array(
          jsonb_build_object(
            'option_id', 'double_room',
            'option', jsonb_build_object(
              'id', 'double_room',
              'name', '2인 1실',
              'name_ko', '2인 1실',
              'adult_price', 80000,
              'child_price', 50000,
              'infant_price', 0,
              'capacity_per_room', 2
            ),
            'quantity', 1,
            'total_capacity', 2,
            'total_price', 210000 -- 성인 2명 * 80,000 + 아동 1명 * 50,000
          ),
          jsonb_build_object(
            'option_id', 'triple_room',
            'option', jsonb_build_object(
              'id', 'triple_room',
              'name', '3인 1실',
              'name_ko', '3인 1실',
              'adult_price', 120000,
              'child_price', 80000,
              'infant_price', 0,
              'capacity_per_room', 3
            ),
            'quantity', 1,
            'total_capacity', 3,
            'total_price', 320000 -- 성인 2명 * 120,000 + 아동 1명 * 80,000
          )
        ),
        'total_capacity', 5,
        'total_price', 530000,
        'timestamp', NOW()::text
      )
    )
  )
);

-- 3. 테스트용 예약 생성 (13인 단체 예약)
INSERT INTO reservations (
  id,
  customer_id,
  product_id,
  tour_date,
  adults,
  child,
  infant,
  total_people,
  channel_id,
  status,
  choices
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM customers LIMIT 1),
  'ACCOMMODATION_TOUR_TEST',
  CURRENT_DATE + INTERVAL '14 days',
  10, -- 성인 10명
  3,  -- 아동 3명
  0,  -- 유아 0명
  13, -- 총 13명
  (SELECT id FROM channels LIMIT 1),
  'pending',
  jsonb_build_object(
    'required', jsonb_build_array(
      jsonb_build_object(
        'id', 'accommodation_choice',
        'selections', jsonb_build_array(
          jsonb_build_object(
            'option_id', 'quad_room',
            'option', jsonb_build_object(
              'id', 'quad_room',
              'name', '4인 1실',
              'name_ko', '4인 1실',
              'adult_price', 150000,
              'child_price', 100000,
              'infant_price', 0,
              'capacity_per_room', 4
            ),
            'quantity', 3,
            'total_capacity', 12,
            'total_price', 1800000 -- 성인 10명 * 150,000 + 아동 3명 * 100,000
          ),
          jsonb_build_object(
            'option_id', 'single_room',
            'option', jsonb_build_object(
              'id', 'single_room',
              'name', '1인 1실',
              'name_ko', '1인 1실',
              'adult_price', 50000,
              'child_price', 30000,
              'infant_price', 0,
              'capacity_per_room', 1
            ),
            'quantity', 1,
            'total_capacity', 1,
            'total_price', 50000 -- 성인 1명 * 50,000
          )
        ),
        'total_capacity', 13,
        'total_price', 1850000,
        'timestamp', NOW()::text
      )
    )
  )
);

-- 4. 테스트 결과 확인
SELECT 
  r.id,
  r.product_id,
  r.adults,
  r.child,
  r.infant,
  r.total_people,
  r.choices->'required'->0->>'id' as choice_id,
  jsonb_array_length(r.choices->'required'->0->'selections') as selection_count,
  (r.choices->'required'->0->>'total_capacity')::integer as total_capacity,
  (r.choices->'required'->0->>'total_price')::integer as total_price
FROM reservations r
WHERE r.product_id = 'ACCOMMODATION_TOUR_TEST'
ORDER BY r.created_at DESC;

-- 5. 수용 인원 검증 테스트
SELECT 
  r.id,
  r.total_people,
  (r.choices->'required'->0->>'total_capacity')::integer as accommodation_capacity,
  CASE 
    WHEN (r.choices->'required'->0->>'total_capacity')::integer >= r.total_people 
    THEN 'OK' 
    ELSE 'ERROR: 수용 인원 부족' 
  END as validation_result
FROM reservations r
WHERE r.product_id = 'ACCOMMODATION_TOUR_TEST';

-- 6. 가격 계산 함수 테스트
SELECT 
  r.id,
  r.adults,
  r.child,
  r.infant,
  calculate_accommodation_total(
    r.choices->'required'->0->'selections',
    r.adults,
    r.child,
    r.infant
  ) as calculated_price,
  (r.choices->'required'->0->>'total_price')::integer as stored_price
FROM reservations r
WHERE r.product_id = 'ACCOMMODATION_TOUR_TEST';

-- 7. 수용 인원 검증 함수 테스트
SELECT 
  r.id,
  r.total_people,
  validate_accommodation_capacity(
    r.choices->'required'->0->'selections',
    r.total_people
  ) as capacity_valid
FROM reservations r
WHERE r.product_id = 'ACCOMMODATION_TOUR_TEST';
