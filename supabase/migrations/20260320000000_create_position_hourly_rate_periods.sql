-- OP / Office Manager 기본 시급 이력 (기간별 조회·감사용)
CREATE TABLE IF NOT EXISTS position_hourly_rate_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_key TEXT NOT NULL CHECK (position_key IN ('op', 'office manager')),
  hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT position_hourly_rate_periods_date_order CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_position_hourly_rate_periods_lookup
  ON position_hourly_rate_periods (position_key, effective_from);

COMMENT ON TABLE position_hourly_rate_periods IS 'OP·Office Manager 직무 기준 시급 구간 (effective_from~effective_to, 종료일 NULL=현재 구간)';

ALTER TABLE position_hourly_rate_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "position_hourly_rate_periods_all"
  ON position_hourly_rate_periods
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 기존 하드코딩 값과 동일한 시작 데이터 (이미 있으면 생략)
INSERT INTO position_hourly_rate_periods (position_key, hourly_rate, effective_from, effective_to, notes)
SELECT 'op', 15.00, '2000-01-01', NULL, 'Initial (legacy default)'
WHERE NOT EXISTS (SELECT 1 FROM position_hourly_rate_periods WHERE position_key = 'op');

INSERT INTO position_hourly_rate_periods (position_key, hourly_rate, effective_from, effective_to, notes)
SELECT 'office manager', 17.00, '2000-01-01', NULL, 'Initial (legacy default)'
WHERE NOT EXISTS (SELECT 1 FROM position_hourly_rate_periods WHERE position_key = 'office manager');
