-- OP별 팁 쉐어를 저장하는 별도 테이블 생성
-- 여러 OP가 나눠서 가져갈 수 있도록 함

CREATE TABLE IF NOT EXISTS tour_tip_share_ops (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_tip_share_id UUID NOT NULL REFERENCES tour_tip_shares(id) ON DELETE CASCADE,
  op_email TEXT NOT NULL REFERENCES team(email) ON DELETE CASCADE,
  op_amount DECIMAL(10,2) DEFAULT 0.00,
  op_percent DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_tip_share_id, op_email)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tour_tip_share_ops_tour_tip_share_id ON tour_tip_share_ops(tour_tip_share_id);
CREATE INDEX IF NOT EXISTS idx_tour_tip_share_ops_op_email ON tour_tip_share_ops(op_email);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_tour_tip_share_ops_updated_at ON tour_tip_share_ops;
CREATE TRIGGER update_tour_tip_share_ops_updated_at
  BEFORE UPDATE ON tour_tip_share_ops
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_tip_shares_updated_at();

-- RLS 정책 설정
ALTER TABLE tour_tip_share_ops ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "team_members_can_view_own_op_shares" ON tour_tip_share_ops;
DROP POLICY IF EXISTS "admins_can_view_all_op_shares" ON tour_tip_share_ops;
DROP POLICY IF EXISTS "admins_can_manage_op_shares" ON tour_tip_share_ops;

-- 팀 멤버는 자신의 OP 팁 쉐어 정보를 조회할 수 있음
CREATE POLICY "team_members_can_view_own_op_shares" ON tour_tip_share_ops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND team.email = op_email
    )
  );

-- 관리자는 모든 OP 팁 쉐어 정보를 조회할 수 있음
CREATE POLICY "admins_can_view_all_op_shares" ON tour_tip_share_ops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND team.position IN ('Super', 'Office Manager', 'OP')
    )
  );

-- 관리자는 OP 팁 쉐어 정보를 생성/수정/삭제할 수 있음
CREATE POLICY "admins_can_manage_op_shares" ON tour_tip_share_ops
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team
      WHERE team.email = auth.jwt() ->> 'email'
      AND team.is_active = true
      AND team.position IN ('Super', 'Office Manager', 'OP')
    )
  );

