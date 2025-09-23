-- 팀 그룹 채팅을 위한 테이블 생성
-- Migration: 202501200001_create_team_chat_tables

-- 팀 채팅방 테이블
CREATE TABLE IF NOT EXISTS team_chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name TEXT NOT NULL,
  room_type VARCHAR(20) NOT NULL DEFAULT 'general' CHECK (room_type IN ('general', 'department', 'project', 'announcement')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(255) NOT NULL, -- 생성자 이메일
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 팀 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS team_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES team_chat_rooms(id) ON DELETE CASCADE,
  sender_email VARCHAR(255) NOT NULL, -- 발신자 이메일
  sender_name TEXT NOT NULL, -- 발신자 이름
  sender_position VARCHAR(100), -- 발신자 직책
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'announcement')),
  file_url TEXT, -- 첨부 파일 URL
  file_name TEXT, -- 첨부 파일명
  file_size INTEGER, -- 파일 크기
  is_pinned BOOLEAN DEFAULT false, -- 고정 메시지
  reply_to_id UUID REFERENCES team_chat_messages(id), -- 답글 대상 메시지 ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 팀 채팅 참여자 테이블
CREATE TABLE IF NOT EXISTS team_chat_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES team_chat_rooms(id) ON DELETE CASCADE,
  participant_email VARCHAR(255) NOT NULL, -- 참여자 이메일
  participant_name TEXT NOT NULL, -- 참여자 이름
  participant_position VARCHAR(100), -- 참여자 직책
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  is_admin BOOLEAN DEFAULT false, -- 채팅방 관리자 여부
  UNIQUE(room_id, participant_email)
);

-- 팀 채팅 읽음 상태 테이블
CREATE TABLE IF NOT EXISTS team_chat_read_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES team_chat_messages(id) ON DELETE CASCADE,
  reader_email VARCHAR(255) NOT NULL, -- 읽은 사용자 이메일
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, reader_email)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_team_chat_rooms_type ON team_chat_rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_team_chat_rooms_active ON team_chat_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_team_chat_messages_room_id ON team_chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_messages_sender ON team_chat_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_team_chat_messages_created_at ON team_chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_team_chat_messages_pinned ON team_chat_messages(is_pinned);

CREATE INDEX IF NOT EXISTS idx_team_chat_participants_room_id ON team_chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_participants_email ON team_chat_participants(participant_email);

CREATE INDEX IF NOT EXISTS idx_team_chat_read_status_message_id ON team_chat_read_status(message_id);
CREATE INDEX IF NOT EXISTS idx_team_chat_read_status_reader ON team_chat_read_status(reader_email);

-- 기본 채팅방 생성 (전체 팀 채팅방)
INSERT INTO team_chat_rooms (room_name, room_type, description, created_by) 
VALUES ('전체 팀 채팅', 'general', '전체 팀원이 참여하는 공식 채팅방입니다.', 'admin@kovegas.com');

-- RLS 정책 설정
ALTER TABLE team_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_chat_read_status ENABLE ROW LEVEL SECURITY;

-- 팀 채팅방 조회 정책 (활성 팀원만)
CREATE POLICY "팀원은 활성 채팅방을 조회할 수 있음" ON team_chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅방 생성 정책 (매니저 이상만)
CREATE POLICY "매니저 이상은 채팅방을 생성할 수 있음" ON team_chat_rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position IN ('super', 'office manager')
    )
  );

-- 팀 채팅방 수정 정책 (생성자 또는 매니저 이상)
CREATE POLICY "생성자 또는 매니저는 채팅방을 수정할 수 있음" ON team_chat_rooms
  FOR UPDATE USING (
    created_by = auth.jwt() ->> 'email' OR
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position IN ('super', 'office manager')
    )
  );

-- 팀 채팅 메시지 조회 정책 (참여자만)
CREATE POLICY "참여자는 메시지를 조회할 수 있음" ON team_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_chat_participants tcp
      JOIN team t ON t.email = tcp.participant_email
      WHERE tcp.room_id = team_chat_messages.room_id
      AND tcp.participant_email = auth.jwt() ->> 'email'
      AND tcp.is_active = true
      AND t.is_active = true
    )
  );

-- 팀 채팅 메시지 생성 정책 (참여자만)
CREATE POLICY "참여자는 메시지를 생성할 수 있음" ON team_chat_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_chat_participants tcp
      JOIN team t ON t.email = tcp.participant_email
      WHERE tcp.room_id = team_chat_messages.room_id
      AND tcp.participant_email = auth.jwt() ->> 'email'
      AND tcp.is_active = true
      AND t.is_active = true
    )
  );

-- 팀 채팅 참여자 조회 정책 (팀원만)
CREATE POLICY "팀원은 참여자 정보를 조회할 수 있음" ON team_chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 팀 채팅 참여자 관리 정책 (매니저 이상만)
CREATE POLICY "매니저는 참여자를 관리할 수 있음" ON team_chat_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
      AND team.position IN ('super', 'office manager')
    )
  );

-- 팀 채팅 읽음 상태 정책 (본인 것만)
CREATE POLICY "사용자는 자신의 읽음 상태를 관리할 수 있음" ON team_chat_read_status
  FOR ALL USING (reader_email = auth.jwt() ->> 'email');

-- 댓글 추가
COMMENT ON TABLE team_chat_rooms IS '팀 그룹 채팅방 관리 테이블';
COMMENT ON TABLE team_chat_messages IS '팀 채팅 메시지 테이블';
COMMENT ON TABLE team_chat_participants IS '팀 채팅 참여자 관리 테이블';
COMMENT ON TABLE team_chat_read_status IS '팀 채팅 메시지 읽음 상태 테이블';
