-- reservation_choices_backup에서 reservation_choices 테이블로 데이터 복원
-- 기존 reservation_choices 데이터 삭제 (필요시)
-- DELETE FROM public.reservation_choices;

-- reservation_choices_backup에서 데이터 복원
-- JSON 형태의 choices 데이터를 파싱하여 reservation_choices 테이블에 삽입

-- 먼저 reservation_choices_backup 테이블 구조 확인
-- SELECT * FROM reservation_choices_backup LIMIT 5;

-- JSON 데이터를 파싱하여 reservation_choices에 삽입하는 쿼리
INSERT INTO public.reservation_choices (
  reservation_id,
  choice_id,
  option_id,
  quantity,
  total_price,
  created_at
)
SELECT 
  rcb.id as reservation_id,
  pc.id as choice_id,
  co.id as option_id,
  1 as quantity, -- 기본 수량 1
  0 as total_price, -- 기본 가격 0 (실제 가격은 옵션에서 가져옴)
  rcb.created_at
FROM reservation_choices_backup rcb
CROSS JOIN LATERAL jsonb_array_elements(
  (rcb.choices::jsonb->>'required')::jsonb
) AS choice_data
CROSS JOIN LATERAL jsonb_array_elements(
  choice_data->'options'
) AS option_data
LEFT JOIN product_choices pc ON (
  pc.choice_group = choice_data->>'name' OR 
  pc.choice_group_ko = choice_data->>'name_ko'
)
LEFT JOIN choice_options co ON (
  co.option_key = option_data->>'id' OR
  co.option_name = option_data->>'name' OR
  co.option_name_ko = option_data->>'name_ko'
)
WHERE pc.id IS NOT NULL AND co.id IS NOT NULL;

-- 복원된 데이터 확인
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
ORDER BY rc.created_at DESC;

-- 통계 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT reservation_id) as unique_reservations,
  COUNT(DISTINCT choice_id) as unique_choices,
  COUNT(DISTINCT option_id) as unique_options
FROM public.reservation_choices;
