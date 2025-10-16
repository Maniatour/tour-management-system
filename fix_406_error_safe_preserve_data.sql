-- 기존 데이터를 유지하면서 406 에러 해결하는 안전한 스크립트
-- 테이블을 삭제하지 않고 기존 데이터를 보존하면서 수정

-- ============================================
-- 1. tour_course_photos 테이블 안전 수정
-- ============================================

-- 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS tour_course_photos (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES tour_courses(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_alt_ko VARCHAR(255),
    photo_alt_en VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sort_order INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    uploaded_by TEXT
);

-- 필요한 컬럼이 없으면 추가 (기존 데이터 보존)
DO $$
BEGIN
    -- photo_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_url TEXT;
        -- 기존 데이터가 있다면 기본값 설정
        UPDATE tour_course_photos SET photo_url = 'default.jpg' WHERE photo_url IS NULL;
        ALTER TABLE tour_course_photos ALTER COLUMN photo_url SET NOT NULL;
    END IF;
    
    -- photo_alt_ko 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_alt_ko'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_alt_ko VARCHAR(255);
    END IF;
    
    -- photo_alt_en 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_alt_en'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_alt_en VARCHAR(255);
    END IF;
    
    -- display_order 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'display_order'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN display_order INTEGER DEFAULT 0;
    END IF;
    
    -- is_primary 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
    
    -- sort_order 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN sort_order INTEGER DEFAULT 0;
    END IF;
    
    -- thumbnail_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'thumbnail_url'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN thumbnail_url TEXT;
    END IF;
    
    -- uploaded_by 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'uploaded_by'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN uploaded_by TEXT;
    END IF;
END $$;

-- 인덱스 생성 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_display_order ON tour_course_photos(display_order);

-- ============================================
-- 2. product_media 테이블 안전 수정
-- ============================================

-- 테이블이 존재하지 않으면 생성
CREATE TABLE IF NOT EXISTS product_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
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

-- 필요한 컬럼이 없으면 추가 (기존 데이터 보존)
DO $$
BEGIN
    -- file_url 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_url TEXT;
        -- 기존 데이터가 있다면 기본값 설정
        UPDATE product_media SET file_url = 'default.jpg' WHERE file_url IS NULL;
        ALTER TABLE product_media ALTER COLUMN file_url SET NOT NULL;
    END IF;
    
    -- file_type 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_type'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_type VARCHAR(50);
        -- 기존 데이터가 있다면 기본값 설정
        UPDATE product_media SET file_type = 'image' WHERE file_type IS NULL;
        ALTER TABLE product_media ALTER COLUMN file_type SET NOT NULL;
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

-- 인덱스 생성 (이미 존재하면 무시)
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_file_type ON product_media(product_id, file_type);
CREATE INDEX IF NOT EXISTS idx_product_media_order_index ON product_media(product_id, order_index);
CREATE INDEX IF NOT EXISTS idx_product_media_is_active ON product_media(is_active);

-- ============================================
-- 3. RLS 정책 안전 수정
-- ============================================

-- tour_course_photos RLS 정책 수정
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (안전하게)
DROP POLICY IF EXISTS "tour_course_photos_select_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_insert_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_update_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_delete_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "Allow public read access to tour_course_photos" ON tour_course_photos;
DROP POLICY IF EXISTS "Allow authenticated users to manage tour_course_photos" ON tour_course_photos;

-- 새로운 정책 생성
CREATE POLICY "Allow public read access to tour_course_photos" ON tour_course_photos
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage tour_course_photos" ON tour_course_photos
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- product_media RLS 정책 수정
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (안전하게)
DROP POLICY IF EXISTS "Anyone can view product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can insert product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can update product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can delete product media" ON product_media;
DROP POLICY IF EXISTS "Allow public read access to product_media" ON product_media;
DROP POLICY IF EXISTS "Allow authenticated users to manage product_media" ON product_media;

-- 새로운 정책 생성
CREATE POLICY "Allow public read access to product_media" ON product_media
    FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to manage product_media" ON product_media
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 4. updated_at 트리거 설정
-- ============================================

-- 트리거 함수 생성 (이미 존재하면 교체)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- product_media 트리거 생성 (기존 트리거가 있으면 삭제 후 재생성)
DROP TRIGGER IF EXISTS update_product_media_updated_at ON product_media;
CREATE TRIGGER update_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. Storage 버킷 설정
-- ============================================

-- tour-course-photos 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-course-photos', 'tour-course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- product-media 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정 (기존 정책 삭제 후 재생성)
-- tour-course-photos 버킷 정책
DROP POLICY IF EXISTS "tour_course_photos_storage_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "tour_course_photos_storage_insert_policy" ON storage.objects;

CREATE POLICY "tour_course_photos_storage_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'tour-course-photos');

CREATE POLICY "tour_course_photos_storage_insert_policy" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'tour-course-photos');

-- product-media 버킷 정책
DROP POLICY IF EXISTS "Allow authenticated users to upload product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view product media" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to product media" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload product media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-media');

CREATE POLICY "Allow authenticated users to view product media" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'product-media');

CREATE POLICY "Allow public access to product media" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'product-media');

-- ============================================
-- 6. 데이터 무결성 확인 및 수정
-- ============================================

-- tour_course_photos 테이블의 필수 컬럼 값 확인 및 수정
UPDATE tour_course_photos 
SET photo_url = 'placeholder.jpg' 
WHERE photo_url IS NULL OR photo_url = '';

-- product_media 테이블의 필수 컬럼 값 확인 및 수정
UPDATE product_media 
SET file_url = 'placeholder.jpg' 
WHERE file_url IS NULL OR file_url = '';

UPDATE product_media 
SET file_type = 'image' 
WHERE file_type IS NULL OR file_type = '';

-- ============================================
-- 7. 최종 확인
-- ============================================

-- 테이블 존재 여부 및 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename;

-- RLS 정책 확인
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename, policyname;

-- 테이블 스키마 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('product_media', 'tour_course_photos')
ORDER BY table_name, ordinal_position;

-- 데이터 개수 확인
SELECT 'product_media' as table_name, COUNT(*) as row_count FROM product_media
UNION ALL
SELECT 'tour_course_photos' as table_name, COUNT(*) as row_count FROM tour_course_photos;

-- Storage 버킷 확인
SELECT id, name, public FROM storage.buckets WHERE id IN ('product-media', 'tour-course-photos');

-- 성공 메시지
SELECT '✅ 기존 데이터를 보존하면서 406 에러 해결 완료!' as status;
