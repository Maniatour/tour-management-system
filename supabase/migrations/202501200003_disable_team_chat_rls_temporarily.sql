-- 팀 채팅 RLS 정책을 임시로 비활성화
-- 개발 및 테스트 목적으로만 사용

-- RLS 비활성화
ALTER TABLE team_chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_read_status DISABLE ROW LEVEL SECURITY;

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "매니저 이상은 채팅방을 생성할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "참여자는 메시지를 조회할 수 있음" ON team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 생성할 수 있음" ON team_chat_messages;
DROP POLICY IF EXISTS "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants;
DROP POLICY IF EXISTS "매니저는 참여자를 관리할 수 있음" ON team_chat_participants;
DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 관리할 수 있음" ON team_chat_read_status;
