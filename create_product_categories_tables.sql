-- 상품 카테고리 관리 시스템을 위한 데이터베이스 스키마
-- 카테고리와 서브카테고리를 별도 테이블로 관리 (종속 관계)

-- 1. 상품 카테고리 테이블
CREATE TABLE IF NOT EXISTS product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 상품 서브카테고리 테이블 (카테고리에 종속)
-- 기존 테이블이 있다면 수정하고, 없다면 새로 생성
DO $$
BEGIN
  -- product_sub_categories 테이블이 존재하는지 확인
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_sub_categories') THEN
    -- 기존 테이블에 category_id 컬럼이 있는지 확인
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_sub_categories' AND column_name = 'category_id') THEN
      -- category_id 컬럼 추가
      ALTER TABLE product_sub_categories ADD COLUMN category_id UUID;
      
      -- 기존 데이터 마이그레이션: products 테이블의 데이터를 기반으로 category_id 설정
      UPDATE product_sub_categories 
      SET category_id = pc.id
      FROM products p
      JOIN product_categories pc ON pc.name = p.category
      WHERE product_sub_categories.name = p.sub_category;
      
      -- category_id를 NOT NULL로 변경
      ALTER TABLE product_sub_categories ALTER COLUMN category_id SET NOT NULL;
      
      -- 외래키 제약조건 추가
      ALTER TABLE product_sub_categories 
      ADD CONSTRAINT fk_product_sub_categories_category_id 
      FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE CASCADE;
      
      -- 기존 UNIQUE 제약조건 제거 (name만으로는 유일하지 않을 수 있음)
      ALTER TABLE product_sub_categories DROP CONSTRAINT IF EXISTS product_sub_categories_name_key;
      
      -- 새로운 UNIQUE 제약조건 추가 (category_id, name 조합으로 유일)
      ALTER TABLE product_sub_categories 
      ADD CONSTRAINT unique_sub_category_per_category 
      UNIQUE (category_id, name);
    END IF;
  ELSE
    -- 테이블이 없으면 새로 생성
    CREATE TABLE product_sub_categories (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(category_id, name)
    );
  END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories(name);
CREATE INDEX IF NOT EXISTS idx_product_sub_categories_category_id ON product_sub_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_sub_categories_name ON product_sub_categories(name);

-- RLS 설정
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sub_categories ENABLE ROW LEVEL SECURITY;

-- RLS 정책 생성
DO $$
BEGIN
  -- product_categories 테이블 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'Allow all operations on product_categories for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations on product_categories for authenticated users"
    ON product_categories FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;

  -- product_sub_categories 테이블 정책
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_sub_categories' AND policyname = 'Allow all operations on product_sub_categories for authenticated users'
  ) THEN
    CREATE POLICY "Allow all operations on product_sub_categories for authenticated users"
    ON product_sub_categories FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- updated_at 자동 갱신 트리거
DO $$
BEGIN
  -- product_categories 트리거
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_categories_updated_at') THEN
    CREATE TRIGGER update_product_categories_updated_at
      BEFORE UPDATE ON product_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- product_sub_categories 트리거
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_sub_categories_updated_at') THEN
    CREATE TRIGGER update_product_sub_categories_updated_at
      BEFORE UPDATE ON product_sub_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 기존 products 테이블의 카테고리와 서브카테고리 데이터를 새 테이블로 마이그레이션
INSERT INTO product_categories (name)
SELECT DISTINCT category 
FROM products 
WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;

-- 서브카테고리는 해당 카테고리에 종속되도록 삽입
-- 기존 테이블이 수정된 경우에만 실행
DO $$
BEGIN
  -- product_sub_categories 테이블에 category_id 컬럼이 있는지 확인
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'product_sub_categories' AND column_name = 'category_id') THEN
    INSERT INTO product_sub_categories (category_id, name)
    SELECT DISTINCT 
      pc.id as category_id,
      p.sub_category as name
    FROM products p
    JOIN product_categories pc ON pc.name = p.category
    WHERE p.sub_category IS NOT NULL AND p.sub_category != ''
    ON CONFLICT (category_id, name) DO NOTHING;
  END IF;
END $$;
