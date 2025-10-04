-- Supabase Storage 디버깅 스크라이프트

-- 1. 모든 Storage buckets 확인
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at,
    updated_at
FROM storage.buckets
ORDER BY created_at DESC;

-- 2. storage.objects 테이블의 RLS 상태 확인
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'objects' 
AND schemaname = 'storage';

-- 3. storage.objects 관련 정책들 확인
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%tour%'
ORDER BY policyname;

-- 4. storage.buckets 관련 정책들 확인
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'buckets'
ORDER BY policyname;

-- 5. 현재 사용자 권한 확인
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin
FROM pg_roles 
WHERE rolname = current_user;

-- 6. tour-photos bucket 상태 상세 확인
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'tour-photos') 
        THEN 'EXISTS' 
        ELSE 'NOT_FOUND'
    END as bucket_status,
    (SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'tour-photos') as file_count;

-- 7. RLS 위반 원인 진단
SELECT 
    'Diagnosis Help' as info,
    'If you see RLS violations, try running the bucket creation script manually.' as message,
    'Make sure you are authenticated and have proper permissions.' as tip;
