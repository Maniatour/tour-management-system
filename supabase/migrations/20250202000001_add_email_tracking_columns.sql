-- email_logs 테이블에 읽음 추적 및 발송 상태 추적 컬럼 추가
ALTER TABLE email_logs
ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_email_logs_resend_email_id ON email_logs(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_opened_at ON email_logs(opened_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_delivered_at ON email_logs(delivered_at);
CREATE INDEX IF NOT EXISTS idx_email_logs_bounced_at ON email_logs(bounced_at);

-- 코멘트 추가
COMMENT ON COLUMN email_logs.resend_email_id IS 'Resend에서 발급한 이메일 ID (읽음 추적용)';
COMMENT ON COLUMN email_logs.opened_at IS '이메일을 처음 읽은 시간';
COMMENT ON COLUMN email_logs.opened_count IS '이메일을 읽은 횟수';
COMMENT ON COLUMN email_logs.delivered_at IS '이메일이 전달된 시간';
COMMENT ON COLUMN email_logs.bounced_at IS '이메일이 반송된 시간';
COMMENT ON COLUMN email_logs.bounce_reason IS '반송 사유';
COMMENT ON COLUMN email_logs.clicked_at IS '이메일 내 링크를 처음 클릭한 시간';
COMMENT ON COLUMN email_logs.clicked_count IS '이메일 내 링크를 클릭한 횟수';
