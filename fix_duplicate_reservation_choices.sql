-- reservation_choices 테이블의 중복 데이터 정리
-- 같은 reservation_id, choice_id, option_id 조합이 여러 개 있는 경우 수량과 가격을 합치고 중복 제거

-- 1. 먼저 중복 데이터 확인
SELECT 
  reservation_id,
  choice_id,
  option_id,
  COUNT(*) as duplicate_count,
  SUM(quantity) as total_quantity,
  SUM(total_price) as total_price_sum
FROM reservation_choices
GROUP BY reservation_id, choice_id, option_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. 중복 데이터가 있는 경우 임시 테이블에 정리된 데이터 저장
CREATE TEMP TABLE temp_reservation_choices AS
SELECT 
  reservation_id,
  choice_id,
  option_id,
  SUM(quantity) as quantity,
  SUM(total_price) as total_price,
  MIN(created_at) as created_at
FROM reservation_choices
GROUP BY reservation_id, choice_id, option_id;

-- 3. 기존 중복 데이터 삭제
DELETE FROM reservation_choices
WHERE (reservation_id, choice_id, option_id) IN (
  SELECT reservation_id, choice_id, option_id
  FROM temp_reservation_choices
);

-- 4. 정리된 데이터 다시 삽입
INSERT INTO reservation_choices (reservation_id, choice_id, option_id, quantity, total_price, created_at)
SELECT 
  reservation_id,
  choice_id,
  option_id,
  quantity,
  total_price,
  created_at
FROM temp_reservation_choices;

-- 5. 임시 테이블 삭제
DROP TABLE temp_reservation_choices;

-- 6. 결과 확인
SELECT 
  reservation_id,
  choice_id,
  option_id,
  COUNT(*) as count
FROM reservation_choices
GROUP BY reservation_id, choice_id, option_id
HAVING COUNT(*) > 1;

-- 7. UNIQUE 제약조건이 제대로 작동하는지 확인
-- (이 쿼리가 결과를 반환하지 않아야 함)
SELECT 
  reservation_id,
  choice_id,
  option_id,
  COUNT(*) as count
FROM reservation_choices
GROUP BY reservation_id, choice_id, option_id
HAVING COUNT(*) > 1;

