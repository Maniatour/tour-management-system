-- 입금 내역 테이블 생성
CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, confirmed, rejected
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- bank_transfer, cash, card, etc.
  note TEXT,
  image_file_url TEXT,
  submit_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submit_by VARCHAR(255), -- 제출자 이메일
  confirmed_on TIMESTAMP WITH TIME ZONE,
  confirmed_by VARCHAR(255), -- 확인자 이메일
  amount_krw DECIMAL(10,2), -- 원화 금액
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_payment_records_reservation_id ON payment_records(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_payment_status ON payment_records(payment_status);
CREATE INDEX IF NOT EXISTS idx_payment_records_submit_on ON payment_records(submit_on);

-- RLS 정책 설정
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- 관리자는 모든 입금 내역 조회/수정 가능
CREATE POLICY "Admins can view all payment records" ON payment_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can insert payment records" ON payment_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can update payment records" ON payment_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

CREATE POLICY "Admins can delete payment records" ON payment_records
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM team 
      WHERE team.email = auth.jwt() ->> 'email' 
      AND team.is_active = true
    )
  );

-- 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_payment_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payment_records_updated_at
  BEFORE UPDATE ON payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_records_updated_at();
