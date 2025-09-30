-- Storage 정책 완전 수정 (기존 정책 삭제 후 재생성)
-- 모든 정책을 삭제하고 새로운 관대한 정책을 생성합니다

BEGIN;

-- 1. 모든 기존 storage 정책 삭제 (혹시 모를 정책들까지 모두)
DROP POLICY IF EXISTS "Allow all authenticated users" ON storage.objects;
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

-- 3. tour_photos 테이블의 RLS 비활성화
ALTER TABLE public.tour_photos DISABLE ROW LEVEL SECURITY;

-- 4. 새로운 관대한 정책 생성 (모든 인증된 사용자가 모든 작업 가능)
CREATE POLICY "Allow all authenticated users" ON storage.objects
  FOR ALL USING (auth.role() = 'authenticated');

COMMIT;

-- 확인 쿼리
SELECT 'Storage policies updated successfully' as status;
