-- Storage RLS 정책 완전 비활성화
-- 투어 사진 업로드 문제 해결을 위한 임시 조치

BEGIN;

-- 1. storage.objects 테이블의 모든 정책 삭제
DROP POLICY IF EXISTS "Guides can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access for shared photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can delete their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete tour photos" ON storage.objects;

-- 2. tour-photos 버킷을 public으로 확실히 설정
UPDATE storage.buckets 
SET public = true 
WHERE id = 'tour-photos';

-- 3. tour_photos 테이블의 RLS도 비활성화
ALTER TABLE public.tour_photos DISABLE ROW LEVEL SECURITY;

COMMIT;

-- 확인 쿼리
SELECT 
    id,
    name,
    public
FROM storage.buckets 
WHERE id = 'tour-photos';

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tour_photos';
