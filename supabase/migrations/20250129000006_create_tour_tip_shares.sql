-- 투어 팁 쉐어 테이블 생성
-- 각 투어의 prepaid 팁을 가이드, 어시스턴트, OP가 어떻게 나누는지 기록

CREATE TABLE IF NOT EXISTS tour_tip_shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  guide_email TEXT REFERENCES team(email) ON DELETE SET NULL,
  assistant_email TEXT REFERENCES team(email) ON DELETE SET NULL,
  op_email TEXT REFERENCES team(email) ON DELETE SET NULL,
  guide_percent DECIMAL(5,2) DEFAULT 0.00,
  assistant_percent DECIMAL(5,2) DEFAULT 0.00,
  op_percent DECIMAL(5,2) DEFAULT 0.00,
  guide_amount DECIMAL(10,2) DEFAULT 0.00,
  assistant_amount DECIMAL(10,2) DEFAULT 0.00,
  op_amount DECIMAL(10,2) DEFAULT 0.00,
  total_tip DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_tip_shares_tour_id ON tour_tip_shares(tour_id);
CREATE INDEX IF NOT EXISTS idx_tour_tip_shares_guide_email ON tour_tip_shares(guide_email);
CREATE INDEX IF NOT EXISTS idx_tour_tip_shares_assistant_email ON tour_tip_shares(assistant_email);
CREATE INDEX IF NOT EXISTS idx_tour_tip_shares_op_email ON tour_tip_shares(op_email);

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_tour_tip_shares_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tour_tip_shares_updated_at
  BEFORE UPDATE ON tour_tip_shares
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_tip_shares_updated_at();

-- RLS 정책 설정
ALTER TABLE tour_tip_shares ENABLE ROW LEVEL SECURITY;

-- 팀 멤버는 자신의 팁 쉐어 정보를 조회할 수 있음
CREATE POLICY "team_members_can_view_own_tip_shares" ON tour_tip_shares
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND (
        team.email = guide_email
        OR team.email = assistant_email
        OR team.email = op_email
      )
    )
  );

-- 관리자는 모든 팁 쉐어 정보를 조회할 수 있음
CREATE POLICY "admins_can_view_all_tip_shares" ON tour_tip_shares
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email')
      AND team.is_active = true
      AND (
        LOWER(team.position) IN ('super', 'office manager', 'op')
        OR team.position IN ('Super', 'Office Manager', 'OP')
      )
    )
  );

-- 관리자는 팁 쉐어 정보를 생성할 수 있음
CREATE POLICY "admins_can_insert_tip_shares" ON tour_tip_shares
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email')
      AND team.is_active = true
      AND (
        LOWER(team.position) IN ('super', 'office manager', 'op')
        OR team.position IN ('Super', 'Office Manager', 'OP')
      )
    )
  );

-- 관리자는 팁 쉐어 정보를 수정할 수 있음
CREATE POLICY "admins_can_update_tip_shares" ON tour_tip_shares
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email')
      AND team.is_active = true
      AND (
        LOWER(team.position) IN ('super', 'office manager', 'op')
        OR team.position IN ('Super', 'Office Manager', 'OP')
      )
    )
  );

-- 관리자는 팁 쉐어 정보를 삭제할 수 있음
CREATE POLICY "admins_can_delete_tip_shares" ON tour_tip_shares
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE LOWER(team.email) = LOWER(auth.jwt() ->> 'email')
      AND team.is_active = true
      AND (
        LOWER(team.position) IN ('super', 'office manager', 'op')
        OR team.position IN ('Super', 'Office Manager', 'OP')
      )
    )
  );

