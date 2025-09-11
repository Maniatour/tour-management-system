-- Create chat tables for tour communication
-- Migration: 20250101000106_create_chat_tables

-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  room_code TEXT UNIQUE NOT NULL, -- 고유한 채팅방 코드 (고객이 접근할 때 사용)
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR(255) NOT NULL, -- 가이드 이메일
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('guide', 'customer', 'system')),
  sender_name TEXT NOT NULL,
  sender_email VARCHAR(255), -- 가이드의 경우 이메일, 고객의 경우 예약 ID
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system')),
  file_url TEXT, -- 첨부 파일 URL
  file_name TEXT, -- 첨부 파일명
  file_size INTEGER, -- 파일 크기
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat participants table (선택적 - 고객이 채팅방에 참여할 때 기록)
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  participant_type VARCHAR(20) NOT NULL CHECK (participant_type IN ('guide', 'customer')),
  participant_id TEXT NOT NULL, -- 가이드 이메일 또는 고객 예약 ID
  participant_name TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_tour_id ON chat_rooms(tour_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_room_code ON chat_rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_is_active ON chat_rooms(is_active);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_type ON chat_messages(sender_type);

CREATE INDEX IF NOT EXISTS idx_chat_participants_room_id ON chat_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_participant_id ON chat_participants(participant_id);

-- Enable RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat_rooms
CREATE POLICY "Guides can view rooms they created" ON chat_rooms
  FOR SELECT USING (created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can view all rooms" ON chat_rooms
  FOR SELECT USING (true);

CREATE POLICY "Public access for active rooms" ON chat_rooms
  FOR SELECT USING (is_active = true);

CREATE POLICY "Guides can create rooms" ON chat_rooms
  FOR INSERT WITH CHECK (created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can create rooms" ON chat_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Guides can update their own rooms" ON chat_rooms
  FOR UPDATE USING (created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can update all rooms" ON chat_rooms
  FOR UPDATE USING (true);

-- RLS policies for chat_messages
CREATE POLICY "Guides can view messages in their rooms" ON chat_messages
  FOR SELECT USING (
    room_id IN (
      SELECT id FROM chat_rooms 
      WHERE created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can view all messages" ON chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Public access for active room messages" ON chat_messages
  FOR SELECT USING (
    room_id IN (SELECT id FROM chat_rooms WHERE is_active = true)
  );

CREATE POLICY "Guides can insert messages" ON chat_messages
  FOR INSERT WITH CHECK (
    room_id IN (
      SELECT id FROM chat_rooms 
      WHERE created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can insert messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can insert messages in active rooms" ON chat_messages
  FOR INSERT WITH CHECK (
    room_id IN (SELECT id FROM chat_rooms WHERE is_active = true)
  );

-- RLS policies for chat_participants
CREATE POLICY "Guides can view participants in their rooms" ON chat_participants
  FOR SELECT USING (
    room_id IN (
      SELECT id FROM chat_rooms 
      WHERE created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can view all participants" ON chat_participants
  FOR SELECT USING (true);

CREATE POLICY "Public access for active room participants" ON chat_participants
  FOR SELECT USING (
    room_id IN (SELECT id FROM chat_rooms WHERE is_active = true)
  );

CREATE POLICY "Guides can manage participants" ON chat_participants
  FOR ALL USING (
    room_id IN (
      SELECT id FROM chat_rooms 
      WHERE created_by = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    )
  );

CREATE POLICY "Admins can manage all participants" ON chat_participants
  FOR ALL USING (true);

CREATE POLICY "Public can manage participants in active rooms" ON chat_participants
  FOR ALL USING (
    room_id IN (SELECT id FROM chat_rooms WHERE is_active = true)
  );

-- Add comments
COMMENT ON TABLE chat_rooms IS 'Chat rooms for tour communication between guides and customers';
COMMENT ON TABLE chat_messages IS 'Messages in chat rooms';
COMMENT ON TABLE chat_participants IS 'Participants in chat rooms';

COMMENT ON COLUMN chat_rooms.room_code IS 'Unique code for customers to access the chat room';
COMMENT ON COLUMN chat_messages.sender_type IS 'Type of sender: guide, customer, or system';
COMMENT ON COLUMN chat_messages.message_type IS 'Type of message: text, image, file, or system';
COMMENT ON COLUMN chat_participants.participant_id IS 'Guide email or customer reservation ID';
