-- 기존 스토리지 버킷 확인 및 정책 설정
-- tour-materials 버킷이 이미 존재하는 경우 사용

-- 1. 기존 버킷 확인
SELECT id, name, public, file_size_limit, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'tour-materials';

-- 2. 기존 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%tour-materials%';

-- 3. 기존 정책 삭제 (필요시)
-- DROP POLICY IF EXISTS "투어 자료 읽기" ON storage.objects;
-- DROP POLICY IF EXISTS "투어 자료 업로드" ON storage.objects;
-- DROP POLICY IF EXISTS "투어 자료 업데이트" ON storage.objects;
-- DROP POLICY IF EXISTS "투어 자료 삭제" ON storage.objects;

-- 4. 버킷 설정 업데이트 (필요시)
-- UPDATE storage.buckets 
-- SET 
--   public = true,
--   file_size_limit = 104857600,
--   allowed_mime_types = ARRAY[
--     'application/pdf',
--     'text/plain',
--     'application/msword',
--     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--     'audio/mpeg',
--     'audio/wav',
--     'audio/mp3',
--     'video/mp4',
--     'video/avi',
--     'video/quicktime',
--     'image/jpeg',
--     'image/png',
--     'image/gif',
--     'image/webp'
--   ]
-- WHERE id = 'tour-materials';

-- 완료 메시지
SELECT 'tour-materials 버킷이 이미 존재합니다.' as message;
SELECT 'Supabase 대시보드에서 Storage > Policies에서 정책을 설정해주세요.' as next_step;
SELECT 'SUPABASE_STORAGE_SETUP.md 파일을 참고하여 정책을 설정하세요.' as guide;
