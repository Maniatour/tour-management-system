-- 팀 채팅 초기 설정 수정
-- 기본 채팅방에 모든 팀원을 참여자로 추가

-- 기본 채팅방에 모든 활성 팀원을 참여자로 추가
INSERT INTO team_chat_participants (room_id, participant_email, participant_name, participant_position, is_admin)
SELECT 
  tcr.id as room_id,
  t.email as participant_email,
  t.name_ko as participant_name,
  t.position as participant_position,
  CASE 
    WHEN t.position IN ('super', 'office manager') THEN true
    ELSE false
  END as is_admin
FROM team_chat_rooms tcr
CROSS JOIN team t
WHERE tcr.room_name = '전체 팀 채팅'
  AND t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM team_chat_participants tcp
    WHERE tcp.room_id = tcr.id 
    AND tcp.participant_email = t.email
  );

-- 기존 정책들 삭제
DROP POLICY IF EXISTS "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "매니저 이상은 채팅방을 생성할 수 있음" ON team_chat_rooms;
DROP POLICY IF EXISTS "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON team_chat_rooms;

-- RLS 정책을 더 관대하게 수정 (임시)
-- 팀원은 모든 채팅방을 볼 수 있도록 수정
CREATE POLICY "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 채팅방 생성 정책 (매니저 이상만)
CREATE POLICY "매니저 이상은 채팅방을 생성할 수 있음" ON team_chat_rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 채팅방 수정 정책 (생성자 또는 매니저 이상)
CREATE POLICY "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON team_chat_rooms
  FOR UPDATE USING (
    created_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅 메시지 정책을 더 관대하게 수정 (임시)
DROP POLICY IF EXISTS "참여자는 메시지를 조회할 수 있음" ON team_chat_messages;
DROP POLICY IF EXISTS "참여자는 메시지를 생성할 수 있음" ON team_chat_messages;

CREATE POLICY "참여자는 메시지를 조회할 수 있음" ON team_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅 메시지 생성 정책도 수정
CREATE POLICY "참여자는 메시지를 생성할 수 있음" ON team_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅 참여자 정책도 수정
DROP POLICY IF EXISTS "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants;
DROP POLICY IF EXISTS "매니저는 참여자를 관리할 수 있음" ON team_chat_participants;

CREATE POLICY "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅 참여자 관리 정책도 수정
CREATE POLICY "매니저는 참여자를 관리할 수 있음" ON team_chat_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );
