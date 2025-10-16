-- product_media 테이블 스키마 확인 및 수정
-- 실제 데이터베이스 스키마에 맞춰 테이블 구조 확인

-- 1. 현재 테이블 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_media'
ORDER BY ordinal_position;

-- 2. 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS product_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'image', 'video', 'document'
    file_size INTEGER,
    mime_type VARCHAR(100),
    alt_text TEXT,
    caption TEXT,
    order_index INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 필요한 컬럼이 없으면 추가
DO $$
BEGIN
    -- file_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_url TEXT;
    END IF;
    
    -- file_type 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_type'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_type VARCHAR(50);
    END IF;
    
    -- is_active 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE product_media ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
    
    -- order_index 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'order_index'
    ) THEN
        ALTER TABLE product_media ADD COLUMN order_index INTEGER DEFAULT 0;
    END IF;
    
    -- is_primary 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE product_media ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
    
    -- alt_text 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'alt_text'
    ) THEN
        ALTER TABLE product_media ADD COLUMN alt_text TEXT;
    END IF;
    
    -- caption 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'caption'
    ) THEN
        ALTER TABLE product_media ADD COLUMN caption TEXT;
    END IF;
    
    -- file_size 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_size'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_size INTEGER;
    END IF;
    
    -- mime_type 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'mime_type'
    ) THEN
        ALTER TABLE product_media ADD COLUMN mime_type VARCHAR(100);
    END IF;
END $$;

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_file_type ON product_media(product_id, file_type);
CREATE INDEX IF NOT EXISTS idx_product_media_order_index ON product_media(product_id, order_index);
CREATE INDEX IF NOT EXISTS idx_product_media_is_active ON product_media(is_active);

-- 5. RLS 활성화 및 정책 설정
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow public read access to product_media" ON product_media;
DROP POLICY IF EXISTS "Allow authenticated users to manage product_media" ON product_media;

-- 새로운 정책 생성
CREATE POLICY "Allow public read access to product_media" ON product_media
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage product_media" ON product_media
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 6. updated_at 트리거 생성 (없으면)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_product_media_updated_at ON product_media;
CREATE TRIGGER update_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 7. 최종 테이블 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_media'
ORDER BY ordinal_position;
