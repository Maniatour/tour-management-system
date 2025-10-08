-- 테스트용 choices 데이터 추가

-- 1. MDGCSUNRISE 상품에 choices 데이터 추가
UPDATE products 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'canyon_choice',
      'name', 'Canyon Choice',
      'name_ko', '캐년 선택',
      'description', '캐년 투어 선택',
      'options', jsonb_build_array(
        jsonb_build_object(
          'id', 'lower_antelope',
          'name', 'Lower Antelope Canyon',
          'name_ko', '로어 앤텔롭 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', true
        ),
        jsonb_build_object(
          'id', 'antelope_x',
          'name', 'Antelope X Canyon',
          'name_ko', '앤텔롭 X 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', false
        )
      )
    )
  )
)
WHERE id = 'MDGCSUNRISE';

-- 2. MDGC1D 상품에 choices 데이터 추가
UPDATE products 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'canyon_choice',
      'name', 'Canyon Choice',
      'name_ko', '캐년 선택',
      'description', '캐년 투어 선택',
      'options', jsonb_build_array(
        jsonb_build_object(
          'id', 'lower_antelope',
          'name', 'Lower Antelope Canyon',
          'name_ko', '로어 앤텔롭 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', true
        ),
        jsonb_build_object(
          'id', 'antelope_x',
          'name', 'Antelope X Canyon',
          'name_ko', '앤텔롭 X 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', false
        )
      )
    )
  )
)
WHERE id = 'MDGC1D';

-- 3. 최근 MDGCSUNRISE 예약 3개에 choices 데이터 추가 (Lower Antelope Canyon)
UPDATE reservations 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'canyon_choice',
      'name', 'Canyon Choice',
      'name_ko', '캐년 선택',
      'description', '캐년 투어 선택',
      'options', jsonb_build_array(
        jsonb_build_object(
          'id', 'lower_antelope',
          'name', 'Lower Antelope Canyon',
          'name_ko', '로어 앤텔롭 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', true
        )
      )
    )
  )
)
WHERE product_id = 'MDGCSUNRISE' 
  AND id IN (
    SELECT id FROM reservations 
    WHERE product_id = 'MDGCSUNRISE' 
    ORDER BY created_at DESC 
    LIMIT 3
  );

-- 4. 최근 MDGC1D 예약 2개에 choices 데이터 추가 (Antelope X Canyon)
UPDATE reservations 
SET choices = jsonb_build_object(
  'required', jsonb_build_array(
    jsonb_build_object(
      'id', 'canyon_choice',
      'name', 'Canyon Choice',
      'name_ko', '캐년 선택',
      'description', '캐년 투어 선택',
      'options', jsonb_build_array(
        jsonb_build_object(
          'id', 'antelope_x',
          'name', 'Antelope X Canyon',
          'name_ko', '앤텔롭 X 캐년',
          'adult_price', 0,
          'child_price', 0,
          'infant_price', 0,
          'is_default', true
        )
      )
    )
  )
)
WHERE product_id = 'MDGC1D' 
  AND id IN (
    SELECT id FROM reservations 
    WHERE product_id = 'MDGC1D' 
    ORDER BY created_at DESC 
    LIMIT 2
  );

-- 5. 결과 확인
SELECT 
  product_id,
  COUNT(*) as total,
  COUNT(choices) as with_choices,
  choices->'required'->0->'options'->0->>'name' as choice_name
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D')
  AND choices IS NOT NULL
GROUP BY product_id, choices->'required'->0->'options'->0->>'name';
