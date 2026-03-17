-- 투어별 오피스 팁 (Office Tips) 테이블
-- 각 투어에 대해 오피스에 쉐어된 팁 금액과 노트 저장

CREATE TABLE IF NOT EXISTS tour_office_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tour_id TEXT NOT NULL REFERENCES tours(id) ON DELETE CASCADE,
  office_tip_amount DECIMAL(10,2) DEFAULT 0.00,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id)
);

CREATE INDEX IF NOT EXISTS idx_tour_office_tips_tour_id ON tour_office_tips(tour_id);

-- updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_tour_office_tips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tour_office_tips_updated_at ON tour_office_tips;
CREATE TRIGGER update_tour_office_tips_updated_at
  BEFORE UPDATE ON tour_office_tips
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_office_tips_updated_at();

ALTER TABLE tour_office_tips ENABLE ROW LEVEL SECURITY;

-- super / office manager / op 만 조회
CREATE POLICY "staff_can_view_tour_office_tips" ON tour_office_tips
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

CREATE POLICY "staff_can_insert_tour_office_tips" ON tour_office_tips
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

CREATE POLICY "staff_can_update_tour_office_tips" ON tour_office_tips
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

CREATE POLICY "staff_can_delete_tour_office_tips" ON tour_office_tips
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
