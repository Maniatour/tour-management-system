-- reservation_choices 테이블의 중복 데이터를 option_name으로 정리 (간단한 버전)
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

-- 2. 중복 데이터가 있는 경우에만 실행
-- 먼저 중복 데이터를 임시 테이블에 정리
CREATE TEMP TABLE temp_duplicate_choices AS
SELECT 
  rc.reservation_id,
  co.option_name_ko,
  co.option_name,
  (array_agg(rc.choice_id ORDER BY rc.created_at ASC))[1] as choice_id,  -- 가장 오래된 choice_id 선택
  (array_agg(rc.option_id ORDER BY rc.created_at ASC))[1] as option_id,  -- 가장 오래된 option_id 선택
  SUM(rc.quantity) as total_quantity,
  SUM(rc.total_price) as total_price,
  MIN(rc.created_at) as created_at
FROM reservation_choices rc
JOIN choice_options co ON rc.option_id = co.id
GROUP BY rc.reservation_id, co.option_name_ko, co.option_name
HAVING COUNT(*) > 1;

-- 3. 중복 데이터 삭제
DELETE FROM reservation_choices
WHERE id IN (
  SELECT rc.id
  FROM reservation_choices rc
  JOIN choice_options co ON rc.option_id = co.id
  WHERE EXISTS (
    SELECT 1 FROM temp_duplicate_choices tdc
    WHERE tdc.reservation_id = rc.reservation_id
      AND tdc.option_name_ko = co.option_name_ko
      AND tdc.option_name = co.option_name
  )
);

-- 4. 정리된 데이터 다시 삽입
INSERT INTO reservation_choices (reservation_id, choice_id, option_id, quantity, total_price, created_at)
SELECT 
  reservation_id,
  choice_id,
  option_id,
  total_quantity,
  total_price,
  created_at
FROM temp_duplicate_choices;

-- 5. 임시 테이블 삭제
DROP TABLE temp_duplicate_choices;

-- 6. 결과 확인 (option_name 기준으로 중복이 제거되었는지 확인)
SELECT 
  rc.reservation_id,
  co.option_name_ko,
  co.option_name,
  COUNT(*) as count
FROM reservation_choices rc
JOIN choice_options co ON rc.option_id = co.id
GROUP BY rc.reservation_id, co.option_name_ko, co.option_name
HAVING COUNT(*) > 1;

-- 7. 최종 결과 확인
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
