-- 채팅 공지사항 시스템을 위한 테이블 생성
-- 이 마이그레이션은 채팅방 공지사항을 관리하기 위한 테이블들을 생성합니다.

-- 기본 공지사항 템플릿 테이블
CREATE TABLE IF NOT EXISTS chat_announcement_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ko',
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 투어별 공지사항 테이블
CREATE TABLE IF NOT EXISTS tour_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tour_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ko',
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
);

-- 채팅방별 공지사항 테이블
CREATE TABLE IF NOT EXISTS chat_room_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'ko',
    is_active BOOLEAN DEFAULT true,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_chat_announcement_templates_language ON chat_announcement_templates(language);
CREATE INDEX IF NOT EXISTS idx_chat_announcement_templates_active ON chat_announcement_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_tour_announcements_tour_id ON tour_announcements(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_announcements_active ON tour_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_room_announcements_room_id ON chat_room_announcements(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_announcements_active ON chat_room_announcements(is_active);

-- RLS (Row Level Security) 정책 설정
ALTER TABLE chat_announcement_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_announcements ENABLE ROW LEVEL SECURITY;

-- 기본 공지사항 템플릿에 대한 정책
CREATE POLICY "Allow all operations on chat_announcement_templates for authenticated users" 
ON chat_announcement_templates FOR ALL 
TO authenticated 
USING (true);

-- 투어 공지사항에 대한 정책
CREATE POLICY "Allow all operations on tour_announcements for authenticated users" 
ON tour_announcements FOR ALL 
TO authenticated 
USING (true);

-- 채팅방 공지사항에 대한 정책
CREATE POLICY "Allow all operations on chat_room_announcements for authenticated users" 
ON chat_room_announcements FOR ALL 
TO authenticated 
USING (true);

-- 공지사항 조회를 위한 공개 정책 (고객용)
CREATE POLICY "Allow public read access to active announcements" 
ON chat_announcement_templates FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow public read access to active tour announcements" 
ON tour_announcements FOR SELECT 
TO anon 
USING (is_active = true);

CREATE POLICY "Allow public read access to active chat room announcements" 
ON chat_room_announcements FOR SELECT 
TO anon 
USING (is_active = true);

-- 업데이트 시간 자동 갱신을 위한 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_chat_announcement_templates_updated_at 
    BEFORE UPDATE ON chat_announcement_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tour_announcements_updated_at 
    BEFORE UPDATE ON tour_announcements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_room_announcements_updated_at 
    BEFORE UPDATE ON chat_room_announcements 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 공지사항 템플릿 데이터 삽입
INSERT INTO chat_announcement_templates (title, content, language, created_by) VALUES
('환영 인사', '안녕하세요! 투어에 참여해주셔서 감사합니다. 즐거운 시간 되시기 바랍니다.', 'ko', 'system'),
('Welcome Message', 'Welcome! Thank you for joining our tour. We hope you have a wonderful time.', 'en', 'system'),
('안전 안내', '투어 중 안전을 위해 가이드의 안내를 따라주시기 바랍니다.', 'ko', 'system'),
('Safety Notice', 'Please follow the guide''s instructions for your safety during the tour.', 'en', 'system'),
('픽업 안내', '픽업 시간과 장소를 확인해주시고, 지연 시 연락드리겠습니다.', 'ko', 'system'),
('Pickup Information', 'Please check the pickup time and location. We will contact you if there are any delays.', 'en', 'system');
