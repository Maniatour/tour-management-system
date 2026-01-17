-- MDGCSUNRISE와 MDGC1D 상품에 대한 product_choices 및 choice_options 생성
-- 예약 데이터 정리 기능에서 필요한 필수 옵션들

-- 1. MDGCSUNRISE 상품에 대한 product_choice 생성
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
  'MDGCSUNRISE',
  'canyon_choice',
  '캐년 선택',
  'single',
  true,
  1,
  1,
  1
) ON CONFLICT (product_id, choice_group) DO UPDATE
SET 
  choice_group_ko = EXCLUDED.choice_group_ko,
  choice_type = EXCLUDED.choice_type,
  is_required = EXCLUDED.is_required,
  min_selections = EXCLUDED.min_selections,
  max_selections = EXCLUDED.max_selections,
  sort_order = EXCLUDED.sort_order;

-- 2. MDGCSUNRISE의 choice_options 생성 (lower_antelope)
INSERT INTO choice_options (
  choice_id,
  option_key,
  option_name,
  option_name_ko,
  adult_price,
  child_price,
  infant_price,
  capacity,
  is_default,
  is_active,
  sort_order
) VALUES (
  (SELECT id FROM product_choices WHERE product_id = 'MDGCSUNRISE' AND choice_group = 'canyon_choice'),
  'lower_antelope',
  'Lower Antelope Canyon',
  '로어 앤텔로프 캐년',
  0,
  0,
  0,
  1,
  true,
  true,
  1
) ON CONFLICT (choice_id, option_key) DO UPDATE
SET 
  option_name = EXCLUDED.option_name,
  option_name_ko = EXCLUDED.option_name_ko,
  adult_price = EXCLUDED.adult_price,
  child_price = EXCLUDED.child_price,
  infant_price = EXCLUDED.infant_price,
  capacity = EXCLUDED.capacity,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 3. MDGCSUNRISE의 choice_options 생성 (antelope_x)
INSERT INTO choice_options (
  choice_id,
  option_key,
  option_name,
  option_name_ko,
  adult_price,
  child_price,
  infant_price,
  capacity,
  is_default,
  is_active,
  sort_order
) VALUES (
  (SELECT id FROM product_choices WHERE product_id = 'MDGCSUNRISE' AND choice_group = 'canyon_choice'),
  'antelope_x',
  'Antelope X Canyon',
  '앤텔로프 X 캐년',
  0,
  0,
  0,
  1,
  false,
  true,
  2
) ON CONFLICT (choice_id, option_key) DO UPDATE
SET 
  option_name = EXCLUDED.option_name,
  option_name_ko = EXCLUDED.option_name_ko,
  adult_price = EXCLUDED.adult_price,
  child_price = EXCLUDED.child_price,
  infant_price = EXCLUDED.infant_price,
  capacity = EXCLUDED.capacity,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 4. MDGC1D 상품에 대한 product_choice 생성
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
  'MDGC1D',
  'canyon_choice',
  '캐년 선택',
  'single',
  true,
  1,
  1,
  1
) ON CONFLICT (product_id, choice_group) DO UPDATE
SET 
  choice_group_ko = EXCLUDED.choice_group_ko,
  choice_type = EXCLUDED.choice_type,
  is_required = EXCLUDED.is_required,
  min_selections = EXCLUDED.min_selections,
  max_selections = EXCLUDED.max_selections,
  sort_order = EXCLUDED.sort_order;

-- 5. MDGC1D의 choice_options 생성 (lower_antelope)
INSERT INTO choice_options (
  choice_id,
  option_key,
  option_name,
  option_name_ko,
  adult_price,
  child_price,
  infant_price,
  capacity,
  is_default,
  is_active,
  sort_order
) VALUES (
  (SELECT id FROM product_choices WHERE product_id = 'MDGC1D' AND choice_group = 'canyon_choice'),
  'lower_antelope',
  'Lower Antelope Canyon',
  '로어 앤텔로프 캐년',
  0,
  0,
  0,
  1,
  true,
  true,
  1
) ON CONFLICT (choice_id, option_key) DO UPDATE
SET 
  option_name = EXCLUDED.option_name,
  option_name_ko = EXCLUDED.option_name_ko,
  adult_price = EXCLUDED.adult_price,
  child_price = EXCLUDED.child_price,
  infant_price = EXCLUDED.infant_price,
  capacity = EXCLUDED.capacity,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 6. MDGC1D의 choice_options 생성 (antelope_x)
INSERT INTO choice_options (
  choice_id,
  option_key,
  option_name,
  option_name_ko,
  adult_price,
  child_price,
  infant_price,
  capacity,
  is_default,
  is_active,
  sort_order
) VALUES (
  (SELECT id FROM product_choices WHERE product_id = 'MDGC1D' AND choice_group = 'canyon_choice'),
  'antelope_x',
  'Antelope X Canyon',
  '앤텔로프 X 캐년',
  0,
  0,
  0,
  1,
  false,
  true,
  2
) ON CONFLICT (choice_id, option_key) DO UPDATE
SET 
  option_name = EXCLUDED.option_name,
  option_name_ko = EXCLUDED.option_name_ko,
  adult_price = EXCLUDED.adult_price,
  child_price = EXCLUDED.child_price,
  infant_price = EXCLUDED.infant_price,
  capacity = EXCLUDED.capacity,
  is_default = EXCLUDED.is_default,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

-- 7. 데이터 확인 쿼리
DO $$
DECLARE
  mdgc_sunrise_choice_count INTEGER;
  mdgc_1d_choice_count INTEGER;
  mdgc_sunrise_options_count INTEGER;
  mdgc_1d_options_count INTEGER;
BEGIN
  -- MDGCSUNRISE choice 확인
  SELECT COUNT(*) INTO mdgc_sunrise_choice_count
  FROM product_choices
  WHERE product_id = 'MDGCSUNRISE' AND choice_group = 'canyon_choice';
  
  -- MDGC1D choice 확인
  SELECT COUNT(*) INTO mdgc_1d_choice_count
  FROM product_choices
  WHERE product_id = 'MDGC1D' AND choice_group = 'canyon_choice';
  
  -- MDGCSUNRISE options 확인
  SELECT COUNT(*) INTO mdgc_sunrise_options_count
  FROM choice_options co
  JOIN product_choices pc ON co.choice_id = pc.id
  WHERE pc.product_id = 'MDGCSUNRISE' 
    AND pc.choice_group = 'canyon_choice'
    AND co.option_key IN ('lower_antelope', 'antelope_x');
  
  -- MDGC1D options 확인
  SELECT COUNT(*) INTO mdgc_1d_options_count
  FROM choice_options co
  JOIN product_choices pc ON co.choice_id = pc.id
  WHERE pc.product_id = 'MDGC1D' 
    AND pc.choice_group = 'canyon_choice'
    AND co.option_key IN ('lower_antelope', 'antelope_x');
  
  -- 결과 출력
  RAISE NOTICE 'MDGCSUNRISE choice: %', mdgc_sunrise_choice_count;
  RAISE NOTICE 'MDGC1D choice: %', mdgc_1d_choice_count;
  RAISE NOTICE 'MDGCSUNRISE options: %', mdgc_sunrise_options_count;
  RAISE NOTICE 'MDGC1D options: %', mdgc_1d_options_count;
  
  IF mdgc_sunrise_choice_count = 1 AND mdgc_1d_choice_count = 1 
     AND mdgc_sunrise_options_count = 2 AND mdgc_1d_options_count = 2 THEN
    RAISE NOTICE 'Successfully created all required product choices and options';
  ELSE
    RAISE WARNING 'Some required choices or options are missing';
  END IF;
END $$;
