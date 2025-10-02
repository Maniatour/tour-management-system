-- 투어 자료 관리를 위한 Supabase 스토리지 버킷 생성
-- 이 스크립트는 Supabase 대시보드에서 실행하거나 supabase CLI를 통해 실행할 수 있습니다.

-- 1. 투어 자료 스토리지 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tour-materials',
  'tour-materials',
  true,
  104857600, -- 100MB 제한
  ARRAY[
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/wav',
    'audio/mp3',
    'video/mp4',
    'video/avi',
    'video/quicktime',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
);

-- 2. 스토리지 정책 설정 (Supabase 대시보드에서 설정하는 것을 권장)
-- 다음 정책들은 Supabase 대시보드의 Storage > Policies에서 설정하세요:

-- 정책 1: 모든 인증된 사용자가 파일을 읽을 수 있음
-- CREATE POLICY "투어 자료 읽기" ON storage.objects
--   FOR SELECT USING (bucket_id = 'tour-materials' AND auth.role() = 'authenticated');

-- 정책 2: 관리자만 파일을 업로드할 수 있음
-- CREATE POLICY "투어 자료 업로드" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND team.position IN ('super', 'office manager')
--     )
--   );

-- 정책 3: 관리자만 파일을 업데이트할 수 있음
-- CREATE POLICY "투어 자료 업데이트" ON storage.objects
--   FOR UPDATE USING (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND team.position IN ('super', 'office manager')
--     )
--   );

-- 정책 4: 관리자만 파일을 삭제할 수 있음
-- CREATE POLICY "투어 자료 삭제" ON storage.objects
--   FOR DELETE USING (
--     bucket_id = 'tour-materials' AND
--     EXISTS (
--       SELECT 1 FROM team 
--       WHERE team.email = auth.email() 
--       AND team.position IN ('super', 'office manager')
--     )
--   );

-- 완료 메시지
SELECT '투어 자료 스토리지 버킷이 성공적으로 생성되었습니다.' as message;
SELECT 'Supabase 대시보드에서 Storage > Policies에서 정책을 설정해주세요.' as next_step;
