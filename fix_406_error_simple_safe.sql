-- 간단한 406 에러 해결 스크립트 (기존 데이터 보존)
-- 최소한의 변경으로 문제 해결

-- ============================================
-- 1. 테이블 존재 확인 및 생성
-- ============================================

-- tour_course_photos 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS tour_course_photos (
    id TEXT PRIMARY KEY,
    course_id TEXT REFERENCES tour_courses(id) ON DELETE CASCADE,
    photo_url TEXT,
    photo_alt_ko VARCHAR(255),
    photo_alt_en VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    sort_order INTEGER DEFAULT 0,
    thumbnail_url TEXT,
    uploaded_by TEXT
);

-- product_media 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS product_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_type VARCHAR(50),
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

-- ============================================
-- 2. 필수 컬럼 추가 (없는 경우만)
-- ============================================

-- tour_course_photos에 photo_url 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tour_course_photos' AND column_name = 'photo_url'
    ) THEN
        ALTER TABLE tour_course_photos ADD COLUMN photo_url TEXT;
    END IF;
END $$;

-- product_media에 file_url 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_url'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_url TEXT;
    END IF;
END $$;

-- product_media에 file_type 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'file_type'
    ) THEN
        ALTER TABLE product_media ADD COLUMN file_type VARCHAR(50);
    END IF;
END $$;

-- product_media에 is_active 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE product_media ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- product_media에 order_index 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'order_index'
    ) THEN
        ALTER TABLE product_media ADD COLUMN order_index INTEGER DEFAULT 0;
    END IF;
END $$;

-- product_media에 is_primary 컬럼이 없으면 추가
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_media' AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE product_media ADD COLUMN is_primary BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================
-- 3. RLS 정책 수정 (기존 데이터 보존)
-- ============================================

-- tour_course_photos RLS 활성화 및 정책 설정
ALTER TABLE tour_course_photos ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tour_course_photos_select_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_insert_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_update_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_delete_policy" ON tour_course_photos;

-- 새로운 정책 생성 - 모든 사용자에게 읽기 허용
CREATE POLICY "Allow public read access to tour_course_photos" ON tour_course_photos
    FOR SELECT USING (true);

-- 인증된 사용자에게 모든 작업 허용
CREATE POLICY "Allow authenticated users to manage tour_course_photos" ON tour_course_photos
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- product_media RLS 활성화 및 정책 설정
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can insert product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can update product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can delete product media" ON product_media;

-- 새로운 정책 생성 - 모든 사용자에게 읽기 허용
CREATE POLICY "Allow public read access to product_media" ON product_media
    FOR SELECT USING (true);

-- 인증된 사용자에게 모든 작업 허용
CREATE POLICY "Allow authenticated users to manage product_media" ON product_media
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 4. 인덱스 생성 (성능 최적화)
-- ============================================

-- tour_course_photos 인덱스
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_course_id ON tour_course_photos(course_id);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_sort_order ON tour_course_photos(sort_order);
CREATE INDEX IF NOT EXISTS idx_tour_course_photos_is_primary ON tour_course_photos(is_primary);

-- product_media 인덱스
CREATE INDEX IF NOT EXISTS idx_product_media_product_id ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_file_type ON product_media(product_id, file_type);
CREATE INDEX IF NOT EXISTS idx_product_media_order_index ON product_media(product_id, order_index);
CREATE INDEX IF NOT EXISTS idx_product_media_is_active ON product_media(is_active);

-- ============================================
-- 5. Storage 버킷 설정
-- ============================================

-- Storage 버킷 생성 (이미 존재하면 무시)
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('tour-course-photos', 'tour-course-photos', true),
    ('product-media', 'product-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage 정책 설정
-- tour-course-photos 버킷 정책
DROP POLICY IF EXISTS "tour_course_photos_storage_select_policy" ON storage.objects;
CREATE POLICY "tour_course_photos_storage_select_policy" ON storage.objects
    FOR SELECT USING (bucket_id = 'tour-course-photos');

-- product-media 버킷 정책
DROP POLICY IF EXISTS "Allow public access to product media" ON storage.objects;
CREATE POLICY "Allow public access to product media" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'product-media');

-- ============================================
-- 6. 확인 및 결과 출력
-- ============================================

-- 테이블 상태 확인
SELECT 
    '테이블 상태' as check_type,
    tablename as name,
    CASE WHEN rowsecurity THEN 'RLS 활성화' ELSE 'RLS 비활성화' END as status
FROM pg_tables 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename;

-- 정책 확인
SELECT 
    'RLS 정책' as check_type,
    tablename as name,
    policyname as policy_name,
    cmd as operation
FROM pg_policies 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename, policyname;

-- 데이터 개수 확인
SELECT 
    '데이터 개수' as check_type,
    'product_media' as name,
    COUNT(*)::text as status
FROM product_media
UNION ALL
SELECT 
    '데이터 개수' as check_type,
    'tour_course_photos' as name,
    COUNT(*)::text as status
FROM tour_course_photos;

-- 성공 메시지
SELECT '✅ 406 에러 해결 완료! 기존 데이터가 보존되었습니다.' as result;
