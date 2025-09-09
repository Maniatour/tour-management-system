-- 특정 상품들의 team_type을 2guide로 업데이트
-- product_id가 'MDGCSUNRISE' 또는 'MDGC1D'인 투어들의 team_type을 '2guide'로 변경

UPDATE tours 
SET team_type = '2guide'
WHERE product_id IN (
  SELECT id FROM products 
  WHERE id IN ('MDGCSUNRISE', 'MDGC1D')
);

-- 결과 확인을 위한 쿼리 (실행 후 확인용)
-- SELECT 
--   t.id,
--   p.id as product_id,
--   p.name as product_name,
--   t.team_type,
--   t.assistant_id
-- FROM tours t
-- JOIN products p ON t.product_id = p.id
-- WHERE p.id IN ('MDGCSUNRISE', 'MDGC1D')
-- ORDER BY p.name, t.tour_date;
