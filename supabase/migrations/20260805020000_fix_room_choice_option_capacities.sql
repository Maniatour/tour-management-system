-- 객실 종류 옵션 capacity를 옵션명(N인 1실 / N people per room)에 맞게 보정.
-- 잘못 저장된 capacity=1(전체) 또는 capacity=99 때문에
-- 고객 예약 시 4인1실이 숨겨지거나 자동 선택되지 않던 문제 보정.

UPDATE choice_options AS co
SET capacity = sub.parsed_capacity
FROM (
  SELECT
    o.id,
    CASE
      WHEN COALESCE(o.option_name_ko, '') ~ '([0-9]+)\s*인'
        THEN (regexp_match(COALESCE(o.option_name_ko, ''), '([0-9]+)\s*인'))[1]::int
      WHEN COALESCE(o.option_name, '') ~* '([0-9]+)\s*(person|people|pax)'
        THEN (regexp_match(lower(COALESCE(o.option_name, '')), '([0-9]+)\s*(person|people|pax)'))[1]::int
      ELSE NULL
    END AS parsed_capacity
  FROM choice_options o
  INNER JOIN product_choices pc ON pc.id = o.choice_id
  WHERE COALESCE(pc.choice_group_ko, pc.choice_group, '') ILIKE '%객실%'
     OR COALESCE(pc.choice_group_en, '') ILIKE '%room%'
) AS sub
WHERE co.id = sub.id
  AND sub.parsed_capacity IS NOT NULL
  AND sub.parsed_capacity BETWEEN 1 AND 10
  AND co.capacity IS DISTINCT FROM sub.parsed_capacity;
