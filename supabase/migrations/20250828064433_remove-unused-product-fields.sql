-- 상품 테이블에서 불필요한 필드 삭제
-- Remove unused fields from products table

-- 1. min_participants 컬럼 삭제
ALTER TABLE products DROP COLUMN IF EXISTS min_participants;

-- 2. difficulty 컬럼 삭제  
ALTER TABLE products DROP COLUMN IF EXISTS difficulty;

-- 3. 변경사항 확인
SELECT 
  'products' as table_name,
  COUNT(*) as record_count,
  'min_participants, difficulty 컬럼 삭제됨' as change_description
FROM products;
