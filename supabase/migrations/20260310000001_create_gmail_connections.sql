-- Gmail API OAuth 연결 정보 (예약 이메일 자동 수신용)
-- 리프레시 토큰 저장, 한 계정만 연결 가정

CREATE TABLE IF NOT EXISTS gmail_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_connections_email ON gmail_connections (email);

ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for gmail_connections" ON gmail_connections FOR ALL USING (true);

COMMENT ON TABLE gmail_connections IS 'Gmail API OAuth 리프레시 토큰; 예약 이메일 자동 수신용';
