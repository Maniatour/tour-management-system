-- 강제로 bucket 접근 문제 해결

-- 1단계: 모든 관련 정책 완전 삭제
DROP POLICY IF EXISTS "Allow authenticated users to list buckets" ON storage.buckets;
DROP POLICY IF EXISTS "Allow anon users to list buckets" ON storage.buckets;
DROP POLICY IF EXISTS "tour-photos-manage-files" ON storage.objects;
DROP POLICY IF EXISTS "tour-photos-public-read" ON storage.objects;

-- 2단계: bucket 강제 재생성
DELETE FROM storage.buckets WHERE id = 'tour-photos';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at)
VALUES (
  'tour-photos',
  'tour-photos',
  true,
  104857600,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  NOW()
);

-- 3단계: 모든 사용자에게 완전한 접근 권한 부여
CREATE POLICY "Completely open bucket access" ON storage.buckets
FOR ALL TO authenticated, anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Completely open object access" ON storage.objects
FOR ALL TO authenticated, anon
USING (bucket_id = 'tour-photos')
WITH CHECK (bucket_id = 'tour-photos');

-- 4단계: 즉시 확인
SELECT 
  'Force Fix Applied!' as status,
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 성공 메시지
SELECT 'Now refresh your browser and try again!' as next_step;
