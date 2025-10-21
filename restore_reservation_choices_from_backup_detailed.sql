-- reservation_choices_backup에서 reservation_choices 테이블로 데이터 복원
-- 제공된 샘플 데이터를 기반으로 한 복원 스크립트

-- 1. 기존 reservation_choices 데이터 삭제 (필요시)
-- DELETE FROM public.reservation_choices;

-- 2. reservation_choices_backup에서 데이터 복원
-- 샘플 데이터: {"idx":0,"id":"0095e90d","choices":"{\"required\": [{\"id\": \"canyon_choice\", \"name\": \"Canyon Choice\", \"name_ko\": \"캐년 선택\", \"options\": [{\"id\": \"lower_antelope\", \"name\": \"Lower Antelope Canyon\", \"name_ko\": \"로어 앤텔롭 캐년\", \"is_default\": true, \"adult_price\": 0, \"child_price\": 0, \"infant_price\": 0}], \"description\": \"캐년 투어 선택\"}]}"}

-- 먼저 product_choices와 choice_options 테이블에 해당 데이터가 있는지 확인
SELECT 'product_choices 확인' as step, COUNT(*) as count FROM product_choices WHERE choice_group_ko LIKE '%캐년%';
SELECT 'choice_options 확인' as step, COUNT(*) as count FROM choice_options WHERE option_name_ko LIKE '%로어%' OR option_name_ko LIKE '%앤텔롭%';

-- 3. 실제 데이터 복원 쿼리
WITH backup_data AS (
  SELECT 
    id as reservation_id,
    choices::jsonb as choices_json,
    created_at
  FROM reservation_choices_backup
  WHERE choices IS NOT NULL AND choices != ''
),
parsed_choices AS (
  SELECT 
    reservation_id,
    created_at,
    jsonb_array_elements(choices_json->'required') as choice_item
  FROM backup_data
),
parsed_options AS (
  SELECT 
    reservation_id,
    created_at,
    choice_item->>'id' as choice_id_key,
    choice_item->>'name' as choice_name,
    choice_item->>'name_ko' as choice_name_ko,
    jsonb_array_elements(choice_item->'options') as option_item
  FROM parsed_choices
)
INSERT INTO public.reservation_choices (
  reservation_id,
  choice_id,
  option_id,
  quantity,
  total_price,
  created_at
)
SELECT 
  po.reservation_id,
  pc.id as choice_id,
  co.id as option_id,
  1 as quantity, -- 기본 수량 1
  COALESCE((po.option_item->>'adult_price')::numeric, 0) as total_price,
  po.created_at
FROM parsed_options po
LEFT JOIN product_choices pc ON (
  pc.choice_group = po.choice_name OR 
  pc.choice_group_ko = po.choice_name_ko OR
  pc.choice_group LIKE '%' || po.choice_id_key || '%'
)
LEFT JOIN choice_options co ON (
  co.option_key = po.option_item->>'id' OR
  co.option_name = po.option_item->>'name' OR
  co.option_name_ko = po.option_item->>'name_ko'
)
WHERE pc.id IS NOT NULL AND co.id IS NOT NULL;

-- 4. 복원된 데이터 확인
SELECT 
  rc.*,
  pc.choice_group_ko,
  co.option_name_ko,
  co.adult_price,
  co.child_price,
  co.infant_price
FROM public.reservation_choices rc
LEFT JOIN product_choices pc ON rc.choice_id = pc.id
LEFT JOIN choice_options co ON rc.option_id = co.id
ORDER BY rc.created_at DESC
LIMIT 10;

-- 5. 통계 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT reservation_id) as unique_reservations,
  COUNT(DISTINCT choice_id) as unique_choices,
  COUNT(DISTINCT option_id) as unique_options
FROM public.reservation_choices;

-- 6. 매칭되지 않은 데이터 확인 (디버깅용)
WITH backup_data AS (
  SELECT 
    id as reservation_id,
    choices::jsonb as choices_json,
    created_at
  FROM reservation_choices_backup
  WHERE choices IS NOT NULL AND choices != ''
),
parsed_choices AS (
  SELECT 
    reservation_id,
    created_at,
    jsonb_array_elements(choices_json->'required') as choice_item
  FROM backup_data
),
parsed_options AS (
  SELECT 
    reservation_id,
    created_at,
    choice_item->>'id' as choice_id_key,
    choice_item->>'name' as choice_name,
    choice_item->>'name_ko' as choice_name_ko,
    jsonb_array_elements(choice_item->'options') as option_item
  FROM parsed_choices
)
SELECT 
  '매칭되지 않은 choice' as type,
  po.choice_name,
  po.choice_name_ko,
  po.choice_id_key
FROM parsed_options po
LEFT JOIN product_choices pc ON (
  pc.choice_group = po.choice_name OR 
  pc.choice_group_ko = po.choice_name_ko OR
  pc.choice_group LIKE '%' || po.choice_id_key || '%'
)
WHERE pc.id IS NULL
UNION ALL
SELECT 
  '매칭되지 않은 option' as type,
  po.option_item->>'name' as choice_name,
  po.option_item->>'name_ko' as choice_name_ko,
  po.option_item->>'id' as choice_id_key
FROM parsed_options po
LEFT JOIN choice_options co ON (
  co.option_key = po.option_item->>'id' OR
  co.option_name = po.option_item->>'name' OR
  co.option_name_ko = po.option_item->>'name_ko'
)
WHERE co.id IS NULL;
