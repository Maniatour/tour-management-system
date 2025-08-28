-- Products 테이블 가격 구조 업데이트
-- Tour Management System Database Update

-- 1. products 테이블 수정
-- 기존 base_price 컬럼을 구조화된 가격으로 변경
ALTER TABLE products 
DROP COLUMN IF EXISTS base_price;

-- 새로운 가격 관련 컬럼들 추가
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS base_pricing JSONB DEFAULT '{
  "adult": 0,
  "child": 0, 
  "infant": 0,
  "currency": "USD",
  "price_unit": "per_person"
}',
ADD COLUMN IF NOT EXISTS has_required_options BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_total_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS max_total_price DECIMAL(10,2);

-- 2. product_options 테이블 생성
CREATE TABLE IF NOT EXISTS product_options (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_id UUID REFERENCES options(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT false,
  is_multiple BOOLEAN DEFAULT false,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  price_adjustment JSONB DEFAULT '{
    "adult": 0,
    "child": 0,
    "infant": 0,
    "adjustment_type": "fixed"
  }',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_options_product_id ON product_options(product_id);
CREATE INDEX IF NOT EXISTS idx_product_options_option_id ON product_options(option_id);
CREATE INDEX IF NOT EXISTS idx_product_options_required ON product_options(is_required);

-- 4. 기존 데이터 마이그레이션 (샘플 데이터가 있다면)
UPDATE products 
SET base_pricing = '{
  "adult": 100,
  "child": 80, 
  "infant": 60,
  "currency": "USD",
  "price_unit": "per_person"
}'
WHERE base_pricing IS NULL;

-- 5. 샘플 상품 옵션 데이터 삽입 (기존 데이터가 있는 경우)
INSERT INTO product_options (product_id, option_id, is_required, is_multiple, price_adjustment, sort_order)
SELECT 
  p.id as product_id,
  o.id as option_id,
  CASE 
    WHEN o.name LIKE '%호텔%' THEN true 
    ELSE false 
  END as is_required,
  CASE 
    WHEN o.name LIKE '%도시락%' THEN true 
    ELSE false 
  END as is_multiple,
  CASE 
    WHEN o.name LIKE '%호텔%' THEN '{"adult": 50, "child": 40, "infant": 30, "adjustment_type": "fixed"}'
    WHEN o.name LIKE '%도시락%' THEN '{"adult": 15, "child": 12, "infant": 10, "adjustment_type": "fixed"}'
    ELSE '{"adult": 0, "child": 0, "infant": 0, "adjustment_type": "fixed"}'
  END as price_adjustment,
  CASE 
    WHEN o.name LIKE '%호텔%' THEN 1
    WHEN o.name LIKE '%도시락%' THEN 2
    ELSE 3
  END as sort_order
FROM products p
CROSS JOIN options o
WHERE o.name IN ('호텔', '도시락', '카시트')
LIMIT 10;

-- 6. 변경사항 확인
SELECT 
  'products' as table_name,
  COUNT(*) as record_count,
  'base_pricing 컬럼 추가됨' as change_description
FROM products
UNION ALL
SELECT 
  'product_options' as table_name,
  COUNT(*) as record_count,
  '새로 생성됨' as change_description
FROM product_options;
