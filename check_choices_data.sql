-- choices 데이터 확인 쿼리

-- 1. reservations 테이블의 choices 컬럼 상태 확인
SELECT 
  COUNT(*) as total_reservations,
  COUNT(choices) as reservations_with_choices,
  COUNT(CASE WHEN choices IS NOT NULL AND choices != '{}'::jsonb THEN 1 END) as non_empty_choices
FROM reservations;

-- 2. MDGCSUNRISE/MDGC1D 상품의 예약들 확인
SELECT 
  product_id,
  COUNT(*) as count,
  COUNT(choices) as with_choices,
  COUNT(CASE WHEN choices IS NOT NULL AND choices != '{}'::jsonb THEN 1 END) as non_empty_choices
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D', 'MDGCSUNRISE_X', 'MDGC1D_X')
GROUP BY product_id;

-- 3. choices 데이터 샘플 확인 (최근 5개)
SELECT 
  id,
  product_id,
  choices,
  created_at
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGC1D')
ORDER BY created_at DESC
LIMIT 5;

-- 4. products 테이블의 choices 확인
SELECT 
  id,
  choices
FROM products 
WHERE id IN ('MDGCSUNRISE', 'MDGC1D');
