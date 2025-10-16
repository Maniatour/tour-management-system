-- 406 에러 진단을 위한 SQL 스크립트
-- product_media와 tour_course_photos 테이블의 상태 확인

-- 1. 테이블 존재 여부 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename;

-- 2. RLS 정책 확인
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

-- 3. 테이블 스키마 확인
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('product_media', 'tour_course_photos')
ORDER BY table_name, ordinal_position;

-- 4. 인덱스 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('product_media', 'tour_course_photos')
ORDER BY tablename, indexname;

-- 5. 외래키 제약조건 확인
SELECT 
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('product_media', 'tour_course_photos')
ORDER BY tc.table_name;

-- 6. 샘플 데이터 확인 (있는 경우)
SELECT 'product_media' as table_name, COUNT(*) as row_count FROM product_media
UNION ALL
SELECT 'tour_course_photos' as table_name, COUNT(*) as row_count FROM tour_course_photos;
