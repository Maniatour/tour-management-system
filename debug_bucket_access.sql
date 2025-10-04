-- JavaScript에서 bucket을 찾지 못하는 문제 디버깅

-- 1단계: bucket 상세 정보 확인
SELECT 
  'Bucket Detail Info' as checkpoint,
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as size_mb,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets 
WHERE id = 'tour-photos';

-- 2단계: 현재 사용자 확인
SELECT 
  'Current User Info' as checkpoint,
  auth.uid() as current_user_id,
  auth.email() as current_email,
  auth.role() as current_role;

-- 3단계: Storage 정책 확인
SELECT 
  'Storage Policies' as checkpoint,
  policyname,
  permissive,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'buckets'
ORDER BY policyname;

-- 4단계: buckets 테이블 권한 확인
SELECT 
  'Buckets Table Permissions' as checkpoint,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_schema = 'storage' 
AND table_name = 'buckets';

-- 5단계: Storage 객체 정책 확인
SELECT 
  'Objects Table Policies' as checkpoint,
  policyname,
  permissive,
  cmd,
  roles
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%tour-photos%';

-- 6단계: 모든 Storage buckets 목록 확인
SELECT 
  'All Storage Buckets' as checkpoint,
  id as bucket_id,
  name as bucket_name,
  public as is_public,
  created_at
FROM storage.buckets
ORDER BY created_at DESC;

-- 7단계: RLS 활성화 상태 확인
SELECT 
  'RLS Status' as checkpoint,
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  hasrules as has_rules
FROM pg_tables 
WHERE schemaname = 'storage' 
AND tablename IN ('buckets', 'objects');

-- 8단계: JavaScript API 접근을 위한 추가 정책 생성
-- buckets 테이블 접근 정책 추가
DROP POLICY IF EXISTS "Allow authenticated users to list buckets" ON storage.buckets;
CREATE POLICY "Allow authenticated users to list buckets" ON storage.buckets
FOR SELECT TO authenticated;

DROP POLICY IF EXISTS "Allow anon users to list buckets" ON storage.buckets;
CREATE POLICY "Allow anon users to list buckets" ON storage.buckets
FOR SELECT TO anon;

-- 9단계: 테스트 bucket 생성 (확실성 확인용)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'test-bucket',
  'test-bucket',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 10단계: 최종 확인
SELECT 
  'Final Status Check' as checkpoint,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'tour-photos') 
    THEN '✅ tour-photos bucket EXISTS'
    ELSE '❌ tour-photos bucket MISSING'
  END as tour_photos_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'test-bucket') 
    THEN '✅ test-bucket EXISTS'
    ELSE '❌ test-bucket MISSING'
  END as test_bucket_status,
  COUNT(*) as total_buckets
FROM storage.buckets;

-- 성공 메시지
SELECT 
  'Debugging Complete!' as status,
  'Check the results above and refresh your browser' as next_step;
