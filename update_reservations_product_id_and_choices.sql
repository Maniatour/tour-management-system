-- reservations 테이블의 product_id 통일 및 choice 데이터 업데이트

-- 0. choices 컬럼이 없으면 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS choices JSONB;

-- 1. 먼저 현재 상태 확인
SELECT 
  product_id,
  COUNT(*) as count,
  CASE 
    WHEN product_id LIKE '%_X' THEN 'Antelope X Canyon'
    ELSE 'Lower Antelope Canyon'
  END as current_choice
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X', 'MDGC1D', 'MDGC1D_X')
GROUP BY product_id;

-- 2. product_id 통일
-- MDGCSUNRISE_X를 MDGCSUNRISE로 통일
UPDATE reservations 
SET product_id = 'MDGCSUNRISE'
WHERE product_id = 'MDGCSUNRISE_X';

-- MDGC1D_X를 MDGC1D로 통일
UPDATE reservations 
SET product_id = 'MDGC1D'
WHERE product_id = 'MDGC1D_X';

-- 3. choice 데이터 업데이트
-- _X가 없었던 경우 (기존 MDGCSUNRISE) -> Lower Antelope Canyon
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
  AND (choices IS NULL OR choices = '{}'::jsonb);

-- _X가 없었던 경우 (기존 MDGC1D) -> Lower Antelope Canyon
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
WHERE product_id = 'MDGC1D' 
  AND (choices IS NULL OR choices = '{}'::jsonb);

-- 4. _X가 있었던 경우 -> Antelope X Canyon
-- 주의: 이 부분은 수동으로 _X였던 레코드들을 식별해야 합니다
-- 예를 들어, 특정 날짜 범위나 다른 조건으로 구분할 수 있습니다

-- MDGCSUNRISE_X였던 레코드들 (예시: 특정 날짜 이후 생성된 것들)
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
WHERE product_id = 'MDGCSUNRISE' 
  AND (choices IS NULL OR choices = '{}'::jsonb)
  AND id IN (
    -- 여기서는 수동으로 _X였던 레코드 ID들을 지정해야 함
    -- 또는 다른 방법으로 식별
    SELECT id FROM reservations 
    WHERE product_id = 'MDGCSUNRISE' 
    AND created_at > '2024-01-01' -- 예시: 특정 날짜 이후 생성된 것들
    LIMIT 100 -- 예시: 일부만 업데이트
  );

-- MDGC1D_X였던 레코드들 (예시: 특정 날짜 이후 생성된 것들)
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
  AND (choices IS NULL OR choices = '{}'::jsonb)
  AND id IN (
    -- 여기서는 수동으로 _X였던 레코드 ID들을 지정해야 함
    -- 또는 다른 방법으로 식별
    SELECT id FROM reservations 
    WHERE product_id = 'MDGC1D' 
    AND created_at > '2024-01-01' -- 예시: 특정 날짜 이후 생성된 것들
    LIMIT 100 -- 예시: 일부만 업데이트
  );

-- 5. 임시 컬럼 제거
ALTER TABLE reservations DROP COLUMN IF EXISTS temp_was_x;

-- 6. 업데이트 결과 확인
SELECT 
  product_id,
  COUNT(*) as count,
  choices->'required'->0->'options'->0->>'name' as choice_name
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D')
GROUP BY product_id, choices->'required'->0->'options'->0->>'name';

-- 7. products 테이블도 업데이트 (필요한 경우)
-- products 테이블에 choices 컬럼이 없으면 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS choices JSONB;

-- MDGCSUNRISE 상품 업데이트
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

-- MDGC1D 상품 업데이트
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

-- 8. 기존 _X 상품들 삭제 (필요한 경우)
-- DELETE FROM products WHERE id IN ('MDGCSUNRISE_X', 'MDGC1D_X');
