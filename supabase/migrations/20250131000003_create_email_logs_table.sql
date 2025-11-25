-- 이메일 발송 기록 테이블 생성
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  email_type VARCHAR(50) NOT NULL, -- 'confirmation', 'departure', 'pickup', 'receipt', 'voucher', 'both'
  subject TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_email_logs_reservation_id ON email_logs(reservation_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email ON email_logs(email);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_logs(email_type);

-- RLS 정책 설정
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 이메일 로그 조회 가능
CREATE POLICY "Admins can view all email logs" ON email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 시스템은 이메일 로그 삽입 가능
CREATE POLICY "System can insert email logs" ON email_logs
  FOR INSERT WITH CHECK (true);

