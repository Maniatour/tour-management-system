-- reservations 테이블의 product_id 통일 및 choice 데이터 업데이트 (수정된 버전)

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

-- 2. _X였던 레코드들의 ID를 임시 테이블에 저장
CREATE TEMP TABLE temp_x_records AS
SELECT 
  id,
  product_id,
  CASE 
    WHEN product_id = 'MDGCSUNRISE_X' THEN 'MDGCSUNRISE'
    WHEN product_id = 'MDGC1D_X' THEN 'MDGC1D'
  END as new_product_id
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE_X', 'MDGC1D_X');

-- 3. product_id 통일
-- MDGCSUNRISE_X를 MDGCSUNRISE로 통일
UPDATE reservations 
SET product_id = 'MDGCSUNRISE'
WHERE product_id = 'MDGCSUNRISE_X';

-- MDGC1D_X를 MDGC1D로 통일
UPDATE reservations 
SET product_id = 'MDGC1D'
WHERE product_id = 'MDGC1D_X';

-- 4. choice 데이터 업데이트
-- 4-1. _X였던 레코드들을 Antelope X Canyon으로 설정
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
WHERE id IN (SELECT id FROM temp_x_records);

-- 4-2. 기존 MDGCSUNRISE 레코드들 (choices가 없는 경우)을 Lower Antelope Canyon으로 설정
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
  AND (choices IS NULL OR choices = '{}'::jsonb)
  AND id NOT IN (SELECT id FROM temp_x_records);

-- 4-3. 기존 MDGC1D 레코드들 (choices가 없는 경우)을 Lower Antelope Canyon으로 설정
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
  AND (choices IS NULL OR choices = '{}'::jsonb)
  AND id NOT IN (SELECT id FROM temp_x_records);

-- 5. 임시 테이블 정리
DROP TABLE temp_x_records;

-- 6. 업데이트 결과 확인
SELECT 
  product_id,
  COUNT(*) as count,
  choices->'required'->0->'options'->0->>'name' as choice_name,
  choices->'required'->0->'options'->0->>'id' as choice_id
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D')
GROUP BY product_id, choices->'required'->0->'options'->0->>'name', choices->'required'->0->'options'->0->>'id'
ORDER BY product_id, choice_name;

-- 7. products 테이블도 업데이트 (필요한 경우)
-- products 테이블에 choices 컬럼이 없으면 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS choices JSONB;

-- MDGCSUNRISE 상품 업데이트 (두 옵션 모두 포함)
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

-- MDGC1D 상품 업데이트 (두 옵션 모두 포함)
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

-- 8. 최종 결과 확인
SELECT 
  'Reservations' as table_name,
  product_id,
  choices->'required'->0->'options'->0->>'name' as choice_name,
  COUNT(*) as count
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D')
GROUP BY product_id, choices->'required'->0->'options'->0->>'name'

UNION ALL

SELECT 
  'Products' as table_name,
  id as product_id,
  choices->'required'->0->'options'->0->>'name' as choice_name,
  COUNT(*) as count
FROM products 
WHERE id IN ('MDGCSUNRISE', 'MDGC1D')
GROUP BY id, choices->'required'->0->'options'->0->>'name'

ORDER BY table_name, product_id, choice_name;

-- 9. 기존 _X 상품들 삭제 (필요한 경우)
-- DELETE FROM products WHERE id IN ('MDGCSUNRISE_X', 'MDGC1D_X');
