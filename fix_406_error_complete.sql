-- 406 에러 완전 해결 스크립트
-- product_media와 tour_course_photos 테이블의 스키마 및 RLS 정책을 완전히 수정

-- ============================================
-- 1. tour_course_photos 테이블 수정
-- ============================================

-- 기존 테이블이 있으면 삭제하고 새로 생성
DROP TABLE IF EXISTS tour_course_photos CASCADE;

-- tour_course_photos 테이블 생성
CREATE TABLE tour_course_photos (
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

-- 인덱스 생성
CREATE INDEX idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);
CREATE INDEX idx_tour_course_photos_display_order ON tour_course_photos(display_order);

-- RLS 활성화 및 정책 설정
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 허용
CREATE POLICY "Allow public read access to tour_course_photos" ON tour_course_photos
    FOR SELECT USING (true);

-- 인증된 사용자에게 모든 작업 허용
CREATE POLICY "Allow authenticated users to manage tour_course_photos" ON tour_course_photos
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 2. product_media 테이블 수정
-- ============================================

-- 기존 테이블이 있으면 삭제하고 새로 생성
DROP TABLE IF EXISTS product_media CASCADE;

-- product_media 테이블 생성
CREATE TABLE product_media (
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

-- 인덱스 생성
CREATE INDEX idx_product_media_product_id ON product_media(product_id);
CREATE INDEX idx_product_media_file_type ON product_media(product_id, file_type);
CREATE INDEX idx_product_media_order_index ON product_media(product_id, order_index);
CREATE INDEX idx_product_media_is_active ON product_media(is_active);

-- RLS 활성화 및 정책 설정
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 허용
CREATE POLICY "Allow public read access to product_media" ON product_media
    FOR SELECT USING (true);

-- 인증된 사용자에게 모든 작업 허용
CREATE POLICY "Allow authenticated users to manage product_media" ON product_media
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- updated_at 트리거 함수 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_at 트리거 생성
CREATE TRIGGER update_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Storage 버킷 설정
-- ============================================

-- tour-course-photos 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('tour-course-photos', 'tour-course-photos', true)
ON CONFLICT (id) DO NOTHING;

-- product-media 버킷 생성
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
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
-- 4. 테스트 데이터 삽입 (선택사항)
-- ============================================

-- 샘플 product_media 데이터 (테스트용)
INSERT INTO product_media (product_id, file_name, file_url, file_type, is_active, order_index)
VALUES 
    ('6bb488ad', 'sample1.jpg', 'https://example.com/sample1.jpg', 'image', true, 1),
    ('MSPICKUP3', 'sample2.jpg', 'https://example.com/sample2.jpg', 'image', true, 1),
    ('SAPPLEC', 'sample3.jpg', 'https://example.com/sample3.jpg', 'image', true, 1)
ON CONFLICT DO NOTHING;

-- 샘플 tour_course_photos 데이터 (테스트용)
INSERT INTO tour_course_photos (id, course_id, photo_url, is_primary, sort_order)
VALUES 
    ('test1', '7af969ef-4d45-4812-8a7e-43661b367fdc', 'sample_course1.jpg', true, 1),
    ('test2', '7af969ef-4d45-4812-8a7e-43661b367fdc', 'sample_course2.jpg', false, 2)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. 최종 확인
-- ============================================

-- 테이블 존재 여부 확인
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

-- 샘플 데이터 확인
SELECT 'product_media' as table_name, COUNT(*) as row_count FROM product_media
UNION ALL
SELECT 'tour_course_photos' as table_name, COUNT(*) as row_count FROM tour_course_photos;

-- Storage 버킷 확인
SELECT id, name, public FROM storage.buckets WHERE id IN ('product-media', 'tour-course-photos');
