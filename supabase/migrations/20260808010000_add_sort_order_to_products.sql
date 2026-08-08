-- products 테이블에 전역 표시 순서 추가
-- sort_order: 관리자/고객 카탈로그 표시 순서 (낮을수록 먼저)

ALTER TABLE products
ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN products.sort_order IS '상품 카탈로그 표시 순서 (낮을수록 먼저 표시)';

-- 기존 데이터가 모두 0이면 이름순으로 초기 순서 부여
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY operator_id
           ORDER BY name ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
         ) - 1 AS rn
  FROM products
)
UPDATE products p
SET sort_order = ordered.rn
FROM ordered
WHERE p.id = ordered.id
  AND NOT EXISTS (
    SELECT 1 FROM products p2
    WHERE p2.operator_id = p.operator_id
      AND p2.sort_order <> 0
  );

CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(operator_id, sort_order);
