-- reservation_choices 테이블의 중복 데이터를 option_name으로 정리
-- 같은 reservation_id와 option_name을 가진 항목들을 하나로 합치기

-- 1. 먼저 중복 데이터 확인 (option_name 기준)
SELECT 
  rc.reservation_id,
  co.option_name_ko,
  co.option_name,
  COUNT(*) as duplicate_count,
  SUM(rc.quantity) as total_quantity,
  SUM(rc.total_price) as total_price_sum
FROM reservation_choices rc
JOIN choice_options co ON rc.option_id = co.id
GROUP BY rc.reservation_id, co.option_name_ko, co.option_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 중복 데이터가 있는 경우 임시 테이블에 정리된 데이터 저장 (option_name 기준)
CREATE TEMP TABLE temp_reservation_choices_by_option AS
SELECT 
  rc.reservation_id,
  rc.choice_id,
  rc.option_id,
  SUM(rc.quantity) as quantity,
  SUM(rc.total_price) as total_price,
  MIN(rc.created_at) as created_at,
  co.option_name_ko,
  co.option_name
FROM reservation_choices rc
JOIN choice_options co ON rc.option_id = co.id
GROUP BY rc.reservation_id, co.option_name_ko, co.option_name, rc.choice_id, rc.option_id;

-- 3. 같은 reservation_id와 option_name을 가진 항목들 중에서 가장 최근의 choice_id와 option_id를 선택
CREATE TEMP TABLE temp_reservation_choices_final AS
SELECT DISTINCT ON (reservation_id, option_name_ko, option_name)
  reservation_id,
  choice_id,
  option_id,
  quantity,
  total_price,
  created_at,
  option_name_ko,
  option_name
FROM temp_reservation_choices_by_option
ORDER BY reservation_id, option_name_ko, option_name, created_at DESC;

-- 4. 기존 중복 데이터 삭제 (같은 reservation_id와 option_name을 가진 항목들)
DELETE FROM reservation_choices
WHERE id IN (
  SELECT rc.id
  FROM reservation_choices rc
  JOIN choice_options co ON rc.option_id = co.id
  WHERE (rc.reservation_id, co.option_name_ko, co.option_name) IN (
    SELECT reservation_id, option_name_ko, option_name
    FROM temp_reservation_choices_by_option
    GROUP BY reservation_id, option_name_ko, option_name
    HAVING COUNT(*) > 1
  )
  AND rc.id NOT IN (
    SELECT rc2.id
    FROM reservation_choices rc2
    JOIN choice_options co2 ON rc2.option_id = co2.id
    JOIN temp_reservation_choices_final t ON 
      rc2.reservation_id = t.reservation_id 
      AND co2.option_name_ko = t.option_name_ko
      AND co2.option_name = t.option_name
      AND rc2.choice_id = t.choice_id
      AND rc2.option_id = t.option_id
  )
);

-- 5. 정리된 데이터 다시 삽입 (필요한 경우에만)
INSERT INTO reservation_choices (reservation_id, choice_id, option_id, quantity, total_price, created_at)
SELECT 
  reservation_id,
  choice_id,
  option_id,
  quantity,
  total_price,
  created_at
FROM temp_reservation_choices_final
WHERE NOT EXISTS (
  SELECT 1 FROM reservation_choices rc
  JOIN choice_options co ON rc.option_id = co.id
  WHERE rc.reservation_id = temp_reservation_choices_final.reservation_id
    AND co.option_name_ko = temp_reservation_choices_final.option_name_ko
    AND co.option_name = temp_reservation_choices_final.option_name
);

-- 6. 임시 테이블 삭제
DROP TABLE temp_reservation_choices_by_option;
DROP TABLE temp_reservation_choices_final;

-- 7. 결과 확인 (option_name 기준으로 중복이 제거되었는지 확인)
SELECT 
  rc.reservation_id,
  co.option_name_ko,
  co.option_name,
  COUNT(*) as count
FROM reservation_choices rc
JOIN choice_options co ON rc.option_id = co.id
GROUP BY rc.reservation_id, co.option_name_ko, co.option_name
HAVING COUNT(*) > 1;

-- 8. 최종 결과 확인
SELECT 
  rc.reservation_id,
  pc.choice_group_ko,
  co.option_name_ko,
  rc.quantity,
  rc.total_price
FROM reservation_choices rc
JOIN product_choices pc ON rc.choice_id = pc.id
JOIN choice_options co ON rc.option_id = co.id
ORDER BY rc.reservation_id, pc.choice_group_ko, co.option_name_ko;
