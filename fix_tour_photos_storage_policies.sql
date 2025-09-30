-- 투어 사진 storage 정책 수정
-- 가이드가 투어 사진을 업로드할 수 있도록 정책을 수정합니다

BEGIN;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Guides can upload photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can view their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all photos" ON storage.objects;
DROP POLICY IF EXISTS "Public access for shared photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can update their own photos" ON storage.objects;
DROP POLICY IF EXISTS "Guides can delete their own photos" ON storage.objects;

-- 새로운 정책 생성
-- 인증된 사용자가 tour-photos 버킷에 업로드할 수 있음
CREATE POLICY "Authenticated users can upload tour photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated'
  );

-- 인증된 사용자가 tour-photos 버킷의 파일을 조회할 수 있음
CREATE POLICY "Authenticated users can view tour photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated'
  );

-- 인증된 사용자가 tour-photos 버킷의 파일을 업데이트할 수 있음
CREATE POLICY "Authenticated users can update tour photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated'
  );

-- 인증된 사용자가 tour-photos 버킷의 파일을 삭제할 수 있음
CREATE POLICY "Authenticated users can delete tour photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tour-photos' AND
    auth.role() = 'authenticated'
  );

-- 공개 사진에 대한 정책 (공유 토큰이 있는 경우)
CREATE POLICY "Public access for shared tour photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'tour-photos' AND
    EXISTS (
      SELECT 1 FROM public.tour_photos 
      WHERE file_path = name 
      AND is_public = true 
      AND share_token IS NOT NULL
    )
  );

COMMIT;
