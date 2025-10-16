-- 406 에러 해결을 위한 RLS 정책 수정
-- product_media와 tour_course_photos 테이블의 RLS 정책을 수정하여 공개 접근 허용

-- 1. product_media 테이블 RLS 정책 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Anyone can view product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can insert product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can update product media" ON product_media;
DROP POLICY IF EXISTS "Authenticated users can delete product media" ON product_media;

-- 새로운 정책 생성 - 모든 사용자에게 읽기 허용
CREATE POLICY "Allow public read access to product_media" ON product_media
    FOR SELECT USING (true);

-- 인증된 사용자에게 쓰기 허용
CREATE POLICY "Allow authenticated users to manage product_media" ON product_media
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 2. tour_course_photos 테이블 RLS 정책 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "tour_course_photos_select_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_insert_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_update_policy" ON tour_course_photos;
DROP POLICY IF EXISTS "tour_course_photos_delete_policy" ON tour_course_photos;

-- 새로운 정책 생성 - 모든 사용자에게 읽기 허용
CREATE POLICY "Allow public read access to tour_course_photos" ON tour_course_photos
    FOR SELECT USING (true);

-- 인증된 사용자에게 쓰기 허용
CREATE POLICY "Allow authenticated users to manage tour_course_photos" ON tour_course_photos
    FOR ALL USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 3. RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename;

-- 4. 정책 확인
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

-- 5. 테이블 존재 여부 및 기본 구조 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('product_media', 'tour_course_photos')
ORDER BY table_name, ordinal_position;
