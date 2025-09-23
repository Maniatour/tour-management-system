-- 팀 채팅 테이블의 RLS 완전 비활성화
-- 임시로 RLS를 비활성화하여 채팅방 생성 문제 해결

-- RLS 비활성화
ALTER TABLE public.team_chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_read_status DISABLE ROW LEVEL SECURITY;

-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "팀원은 활성 채팅방을 조회할 수 있음" ON public.team_chat_rooms;
DROP POLICY IF EXISTS "매니저, OP, 슈퍼유저는 채팅방을 생성할 수 있음" ON public.team_chat_rooms;
DROP POLICY IF EXISTS "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON public.team_chat_rooms;
DROP POLICY IF EXISTS "팀원은 채팅방을 삭제할 수 없음" ON public.team_chat_rooms;

DROP POLICY IF EXISTS "참여자는 메시지를 조회할 수 있음" ON public.team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 전송할 수 있음" ON public.team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 수정할 수 있음" ON public.team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 삭제할 수 있음" ON public.team_chat_messages;

DROP POLICY IF EXISTS "팀원은 참여자 목록을 조회할 수 있음" ON public.team_chat_participants;
DROP POLICY IF EXISTS "매니저 이상은 참여자를 추가할 수 있음" ON public.team_chat_participants;
DROP POLICY IF EXISTS "매니저 이상은 참여자를 수정할 수 있음" ON public.team_chat_participants;
DROP POLICY IF EXISTS "매니저 이상은 참여자를 삭제할 수 있음" ON public.team_chat_participants;

DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 조회할 수 있음" ON public.team_chat_read_status;
DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 생성할 수 있음" ON public.team_chat_read_status;
DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 수정할 수 있음" ON public.team_chat_read_status;
DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 삭제할 수 있음" ON public.team_chat_read_status;

-- 성공 메시지
SELECT '팀 채팅 테이블의 RLS가 완전히 비활성화되었습니다.' as message;
