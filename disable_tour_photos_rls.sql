-- 투어 사진 관련 RLS 비활성화
-- 개발 및 테스트 단계에서 권한 문제를 해결하기 위해 RLS를 비활성화합니다

BEGIN;

-- 1. tour_photos 테이블의 RLS 비활성화
ALTER TABLE public.tour_photos DISABLE ROW LEVEL SECURITY;

-- 2. storage.objects의 tour-photos 관련 정책들 삭제
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

-- 3. tour-photos 버킷을 public으로 변경 (선택사항)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'tour-photos';

COMMIT;

-- 확인 쿼리
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'tour_photos';

SELECT 
    id,
    name,
    public
FROM storage.buckets 
WHERE id = 'tour-photos';
