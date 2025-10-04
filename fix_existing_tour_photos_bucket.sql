-- 기존 tour-photos bucket 정책 수정 스크립트
-- bucket이 이미 존재하므로 정책만 수정합니다

-- 1단계: 기존 충돌하는 정책들 모두 삭제
DROP POLICY IF EXISTS "Allow authenticated users to upload tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete tour photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to tour photos" ON storage.objects;
DROP POLICY IF EXISTS "tour_photos_full_access" ON storage.objects;
DROP POLICY IF EXISTS "tour_photos_public_read" ON storage.objects;

-- 2단계: bucket 설정 업데이트 (public=true, 파일 크기 제한 등)
UPDATE storage.buckets 
SET 
  public = true,
  file_size_limit = 52428800, -- 50MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'tour-photos';

-- 3단계: 새로운 정책들 생성 (간단하고 안전한 버전)

-- 성공한 사용자는 모든 작업 가능
CREATE POLICY "tour_photos_authenticated_full_access" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'tour-photos')
WITH CHECK (bucket_id = 'tour-photos');

-- 익명 사용자는 읽기만 가능
CREATE POLICY "tour_photos_anon_read" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- 4단계: bucket 상태 확인
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 5단계: 정책 상태 확인
SELECT 
  policyname,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%tour_photos%';

-- 6단계: 성공 메시지
SELECT 'tour-photos bucket policies updated successfully!' as status;
