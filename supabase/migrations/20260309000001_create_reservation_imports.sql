-- 예약 가져오기 후보 (이메일 연동)
-- 이메일에서 추출한 예약 후보를 저장하고, 관리자 확인 후 예약으로 생성

CREATE TABLE IF NOT EXISTS reservation_imports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT,
  source_email TEXT,
  platform_key TEXT,
  subject TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  raw_body_text TEXT,
  raw_body_html TEXT,
  extracted_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'duplicate')),
  reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_imports_message_id
  ON reservation_imports (message_id) WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_imports_status ON reservation_imports (status);
CREATE INDEX IF NOT EXISTS idx_reservation_imports_received_at ON reservation_imports (received_at DESC);

ALTER TABLE reservation_imports ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 (기존 admin 정책과 동일: team 테이블에 있는 사용자 또는 서비스 롤)
CREATE POLICY "Allow read for authenticated" ON reservation_imports
  FOR SELECT USING (true);

CREATE POLICY "Allow insert for service" ON reservation_imports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for authenticated" ON reservation_imports
  FOR UPDATE USING (true);

COMMENT ON TABLE reservation_imports IS '이메일 연동 예약 가져오기 후보; 파싱 후 관리자 확인하여 예약 생성';
