-- 팀 채팅 파일 저장소 버킷 생성
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-chat-files',
  'team-chat-files',
  true,
  10485760, -- 10MB
  ARRAY[
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
);

-- 팀 채팅 파일 저장소 정책 설정
CREATE POLICY "팀원은 파일을 업로드할 수 있음" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'team-chat-files' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
    )
  );

CREATE POLICY "팀원은 파일을 조회할 수 있음" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'team-chat-files' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
    )
  );

CREATE POLICY "팀원은 파일을 삭제할 수 있음" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'team-chat-files' AND
    EXISTS (
      SELECT 1 FROM public.team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
    )
  );

-- 성공 메시지
SELECT '팀 채팅 파일 저장소가 생성되었습니다.' as message;
