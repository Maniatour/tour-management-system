-- 팀 채팅 관련 테이블의 RLS 완전 비활성화 확인
-- 모든 관련 테이블의 RLS를 비활성화하고 정책을 삭제

-- RLS 비활성화
ALTER TABLE public.team_chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_read_status DISABLE ROW LEVEL SECURITY;

-- 모든 기존 정책 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- team_chat_rooms 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_chat_rooms' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.team_chat_rooms';
    END LOOP;
    
    -- team_chat_messages 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_chat_messages' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.team_chat_messages';
    END LOOP;
    
    -- team_chat_participants 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_chat_participants' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.team_chat_participants';
    END LOOP;
    
    -- team_chat_read_status 정책 삭제
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'team_chat_read_status' AND schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.team_chat_read_status';
    END LOOP;
END $$;

-- Storage 버킷이 존재하지 않으면 생성
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
)
ON CONFLICT (id) DO NOTHING;

-- 기존 Storage 정책 삭제
DROP POLICY IF EXISTS "팀원은 파일을 업로드할 수 있음" ON storage.objects;
DROP POLICY IF EXISTS "팀원은 파일을 조회할 수 있음" ON storage.objects;
DROP POLICY IF EXISTS "팀원은 파일을 삭제할 수 있음" ON storage.objects;

-- Storage 정책 생성 (간단한 정책)
CREATE POLICY "팀원은 파일을 업로드할 수 있음" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'team-chat-files');

CREATE POLICY "팀원은 파일을 조회할 수 있음" ON storage.objects
  FOR SELECT USING (bucket_id = 'team-chat-files');

CREATE POLICY "팀원은 파일을 삭제할 수 있음" ON storage.objects
  FOR DELETE USING (bucket_id = 'team-chat-files');

-- 성공 메시지
SELECT '팀 채팅 RLS가 완전히 비활성화되었습니다.' as message;
