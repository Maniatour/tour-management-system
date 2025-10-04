-- tour-photos bucket 즉시 생성 및 확인

-- 1단계: 현재 bucket 상태 확인
SELECT 
  'Current Bucket Status' as info,
  COALESCE(COUNT(*), 0) as bucket_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'tour-photos bucket EXISTS'
    ELSE 'tour-photos bucket MISSING - NEED TO CREATE'
  END as status
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 2단계: bucket 생성 (존재하지 않는 경우에만)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  104857600, -- 100MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3단계: bucket 생성 후 확인
SELECT 
  'After Bucket Creation' as info,
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as size_mb,
  allowed_mime_types,
  created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 4단계: Storage 정책 확인 및 생성
DROP POLICY IF EXISTS "tour-photos-manage-files" ON storage.objects;
DROP POLICY IF EXISTS "tour-photos-public-read" ON storage.objects;

CREATE POLICY "tour-photos-manage-files" ON storage.objects
FOR ALL TO authenticated
USING (bucket_id = 'tour-photos')
WITH CHECK (bucket_id = 'tour-photos');

CREATE POLICY "tour-photos-public-read" ON storage.objects
FOR SELECT TO anon
USING (bucket_id = 'tour-photos');

-- 5단계: 정책 생성 확인
SELECT 
  'Storage Policies Status' as info,
  policyname,
  cmd as command,
  array_to_string(roles, ', ') as roles
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%tour-photos%';

-- 6단계: 최종 확인 - 모든 준비 완료
SELECT 
  'Setup Complete!' as status,
  'tour-photos bucket is ready for use' as message,
  'You can now refresh the tour photo page' as next_step;
