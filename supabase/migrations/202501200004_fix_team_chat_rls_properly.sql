-- 팀 채팅 RLS 정책을 제대로 수정
-- position이 super, op, office manager인 사용자가 채팅방을 생성할 수 있도록 설정

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "매니저 이상은 채팅방을 생성할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "참여자는 메시지를 조회할 수 있음" ON team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 생성할 수 있음" ON team_chat_messages;
DROP POLICY IF EXISTS "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants;
DROP POLICY IF EXISTS "매니저는 참여자를 관리할 수 있음" ON team_chat_participants;
DROP POLICY IF EXISTS "사용자는 자신의 읽음 상태를 관리할 수 있음" ON team_chat_read_status;

-- RLS 활성화
ALTER TABLE team_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_read_status ENABLE ROW LEVEL SECURITY;

-- 팀 채팅방 조회 정책 (활성 팀원만)
CREATE POLICY "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email') 
      AND team.is_active = true
    )
  );

-- 팀 채팅방 생성 정책 (super, op, office manager만)
CREATE POLICY "관리자는 채팅방을 생성할 수 있음" ON team_chat_rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email') 
      AND team.is_active = true
      AND LOWER(team.position) IN ('super', 'op', 'office manager')
    )
  );

-- 팀 채팅방 수정 정책 (생성자 또는 관리자)
CREATE POLICY "생성자 또는 관리자는 채팅방을 수정할 수 있음" ON team_chat_rooms
  FOR UPDATE USING (
    created_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email') 
      AND team.is_active = true
      AND LOWER(team.position) IN ('super', 'op', 'office manager')
    )
  );

-- 팀 채팅 메시지 조회 정책 (참여자만)
CREATE POLICY "참여자는 메시지를 조회할 수 있음" ON team_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_chat_participants tcp
      JOIN team t ON LOWER(t.email) = LOWER(tcp.participant_email)
      WHERE tcp.room_id = team_chat_messages.room_id
      AND LOWER(tcp.participant_email) = LOWER(auth.jwt() ->> 'email')
      AND tcp.is_active = true
      AND t.is_active = true
    )
  );

-- 팀 채팅 메시지 생성 정책 (참여자만)
CREATE POLICY "참여자는 메시지를 생성할 수 있음" ON team_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_chat_participants tcp
      JOIN team t ON LOWER(t.email) = LOWER(tcp.participant_email)
      WHERE tcp.room_id = team_chat_messages.room_id
      AND LOWER(tcp.participant_email) = LOWER(auth.jwt() ->> 'email')
      AND tcp.is_active = true
      AND t.is_active = true
    )
  );

-- 팀 채팅 참여자 조회 정책 (팀원만)
CREATE POLICY "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email') 
      AND team.is_active = true
    )
  );

-- 팀 채팅 참여자 관리 정책 (관리자만)
CREATE POLICY "관리자는 참여자를 관리할 수 있음" ON team_chat_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email') 
      AND team.is_active = true
      AND LOWER(team.position) IN ('super', 'op', 'office manager')
    )
  );

-- 팀 채팅 읽음 상태 정책 (본인 것만)
CREATE POLICY "사용자는 자신의 읽음 상태를 관리할 수 있음" ON team_chat_read_status
  FOR ALL USING (LOWER(reader_email) = LOWER(auth.jwt() ->> 'email'));
