-- Storage RLS 강제 비활성화
-- 이 SQL은 모든 storage 관련 RLS를 완전히 비활성화합니다

BEGIN;

-- 1. storage.objects 테이블의 RLS 완전 비활성화
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- 2. storage.buckets 테이블의 RLS 완전 비활성화  
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- 3. 모든 storage 정책 삭제
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

-- 4. tour-photos 버킷을 public으로 설정
UPDATE storage.buckets 
SET public = true 
WHERE id = 'tour-photos';

-- 5. tour_photos 테이블의 RLS도 비활성화
ALTER TABLE public.tour_photos DISABLE ROW LEVEL SECURITY;

COMMIT;

-- 확인 쿼리
SELECT 'Storage RLS disabled successfully' as status;
