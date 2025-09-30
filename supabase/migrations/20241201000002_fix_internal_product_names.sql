-- Fix internal product names migration
-- First, drop the problematic columns if they exist
ALTER TABLE products DROP COLUMN IF EXISTS internal_name_ko;
ALTER TABLE products DROP COLUMN IF EXISTS internal_name_en;
ALTER TABLE products DROP COLUMN IF EXISTS customer_name_ko;
ALTER TABLE products DROP COLUMN IF EXISTS customer_name_en;

-- Add internal name fields
ALTER TABLE products ADD COLUMN internal_name_ko VARCHAR(100) DEFAULT '상품';
ALTER TABLE products ADD COLUMN internal_name_en VARCHAR(100) DEFAULT 'Product';

-- Add customer-facing name fields
ALTER TABLE products ADD COLUMN customer_name_ko VARCHAR(255) DEFAULT '상품';
ALTER TABLE products ADD COLUMN customer_name_en VARCHAR(255) DEFAULT 'Product';

-- Copy existing name_ko and name_en to customer names
UPDATE products 
SET 
  customer_name_ko = COALESCE(name_ko, '상품'),
  customer_name_en = COALESCE(name_en, 'Product');

-- Set internal names to be shorter versions of customer names
UPDATE products 
SET 
  internal_name_ko = CASE 
    WHEN name_ko LIKE '%도깨비%' THEN '도깨비'
    WHEN name_ko LIKE '%앤텔롭%' THEN '앤텔롭'
    WHEN name_ko LIKE '%라스베가스%' THEN '라스베가스'
    WHEN name_ko LIKE '%그랜드캐년%' THEN '그랜드캐년'
    WHEN name_ko LIKE '%불의계곡%' THEN '불의계곡'
    WHEN name_ko LIKE '%데쓰밸리%' THEN '데쓰밸리'
    WHEN name_ko LIKE '%모뉴%' THEN '모뉴1박'
    WHEN name_ko LIKE '%골프%' THEN '골프투어'
    WHEN name_ko LIKE '%후버댐%' THEN '후버댐'
    WHEN name_ko LIKE '%자이언%' THEN '자이언브라이스'
    WHEN name_ko LIKE '%드라이버%' THEN '드라이버'
    WHEN name_ko IS NOT NULL AND LENGTH(name_ko) > 0 THEN LEFT(name_ko, 10)
    ELSE '상품'
  END,
  internal_name_en = CASE 
    WHEN name_en LIKE '%Sunrise%' THEN 'Sunrise'
    WHEN name_en LIKE '%Antelope%' THEN 'Antelope'
    WHEN name_en LIKE '%Las Vegas%' THEN 'Las Vegas'
    WHEN name_en LIKE '%Grand Canyon%' THEN 'Grand Canyon'
    WHEN name_en LIKE '%Valley of Fire%' THEN 'Valley of Fire'
    WHEN name_en LIKE '%Death Valley%' THEN 'Death Valley'
    WHEN name_en LIKE '%Monument%' THEN 'Monument Valley'
    WHEN name_en LIKE '%Golf%' THEN 'Golf Tour'
    WHEN name_en LIKE '%Hoover%' THEN 'Hoover Dam'
    WHEN name_en LIKE '%Zion%' THEN 'Zion Bryce'
    WHEN name_en LIKE '%Driver%' THEN 'Driver'
    WHEN name_en IS NOT NULL AND LENGTH(name_en) > 0 THEN LEFT(name_en, 15)
    ELSE 'Product'
  END;

-- Make the new columns NOT NULL after setting default values
ALTER TABLE products ALTER COLUMN internal_name_ko SET NOT NULL;
ALTER TABLE products ALTER COLUMN internal_name_en SET NOT NULL;
ALTER TABLE products ALTER COLUMN customer_name_ko SET NOT NULL;
ALTER TABLE products ALTER COLUMN customer_name_en SET NOT NULL;

-- Add comments to explain the purpose of each column
COMMENT ON COLUMN products.internal_name_ko IS 'Internal Korean name for admin/calendar use (short)';
COMMENT ON COLUMN products.internal_name_en IS 'Internal English name for admin/calendar use (short)';
COMMENT ON COLUMN products.customer_name_ko IS 'Customer-facing Korean name (full)';
COMMENT ON COLUMN products.customer_name_en IS 'Customer-facing English name (full)';
COMMENT ON COLUMN products.name_ko IS 'Legacy Korean name field (deprecated)';
COMMENT ON COLUMN products.name_en IS 'Legacy English name field (deprecated)';

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_products_internal_name_ko ON products(internal_name_ko);
CREATE INDEX IF NOT EXISTS idx_products_internal_name_en ON products(internal_name_en);
CREATE INDEX IF NOT EXISTS idx_products_customer_name_ko ON products(customer_name_ko);
CREATE INDEX IF NOT EXISTS idx_products_customer_name_en ON products(customer_name_en);
