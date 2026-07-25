-- coupons.product_id stores comma-separated product IDs (or NULL for all products).
-- The FK to products(id) only allows a single UUID and breaks multi-product coupons.

ALTER TABLE coupons
  DROP CONSTRAINT IF EXISTS coupons_product_id_fkey;

COMMENT ON COLUMN coupons.product_id IS
  '적용 상품 ID. NULL이면 전체 상품. 콤마(,)로 구분된 다중 상품 ID 지원.';
