-- email_logs 테이블에 발송한 직원 정보 컬럼 추가
ALTER TABLE email_logs 
ADD COLUMN IF NOT EXISTS sent_by TEXT;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_by ON email_logs(sent_by);

-- 기존 데이터는 NULL로 유지 (이미 발송된 이메일은 발송자 정보가 없음)

