-- Storage 정책만 삭제 (RLS 비활성화 없이)
-- Supabase에서 storage.objects 테이블의 RLS는 비활성화할 수 없으므로 정책만 삭제합니다

BEGIN;

-- 1. 모든 storage 정책 삭제
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

-- 2. tour-photos 버킷을 public으로 설정
UPDATE storage.buckets 
SET public = true 
WHERE id = 'tour-photos';

-- 3. tour_photos 테이블의 RLS 비활성화 (이건 가능)
ALTER TABLE public.tour_photos DISABLE ROW LEVEL SECURITY;

-- 4. 매우 관대한 정책 생성 (모든 인증된 사용자가 모든 작업 가능)
CREATE POLICY "Allow all authenticated users" ON storage.objects
  FOR ALL USING (auth.role() = 'authenticated');

COMMIT;

-- 확인 쿼리
SELECT 'Storage policies updated successfully' as status;
