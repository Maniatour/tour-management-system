-- 특정 상품이 아닌 투어들의 team_type을 1guide로 수정
UPDATE tours 
SET 
  team_type = '1guide',
  assistant_id = NULL
WHERE 
  product_id NOT IN (
    SELECT id FROM products 
    WHERE id IN ('MDGC1D', 'MDGCSUNRISE')
  )
  AND team_type != '1guide';

-- 결과 확인을 위한 쿼리 (실행 후 확인용)
-- SELECT 
--   t.id,
--   p.id as product_id,
--   p.name as product_name,
--   t.team_type,
--   t.assistant_id
-- FROM tours t
-- JOIN products p ON t.product_id = p.id
-- ORDER BY p.name, t.tour_date;
