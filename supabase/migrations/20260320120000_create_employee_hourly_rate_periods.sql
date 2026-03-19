-- 직원별 시급 이력 (기간별 조회·감사용)
CREATE TABLE IF NOT EXISTS employee_hourly_rate_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email TEXT NOT NULL REFERENCES public.team (email) ON DELETE CASCADE,
  hourly_rate NUMERIC(10, 2) NOT NULL CHECK (hourly_rate >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_hourly_rate_periods_date_order CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS idx_employee_hourly_rate_periods_lookup
  ON employee_hourly_rate_periods (employee_email, effective_from);

COMMENT ON TABLE employee_hourly_rate_periods IS '직원(team.email)별 시급 구간 (effective_from~effective_to, 종료일 NULL=현재 구간)';

ALTER TABLE employee_hourly_rate_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_hourly_rate_periods_all"
  ON employee_hourly_rate_periods
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 기존 직무별 시급 테이블이 있으면, 해당 직무 직원에게 동일 구간 복사 (직원별 행이 아직 없을 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'position_hourly_rate_periods'
  ) THEN
    INSERT INTO employee_hourly_rate_periods (employee_email, hourly_rate, effective_from, effective_to, notes)
    SELECT t.email, ph.hourly_rate, ph.effective_from, ph.effective_to,
      TRIM(BOTH ' ' FROM COALESCE(ph.notes, '') || ' (migrated from position_hourly_rate_periods)')
    FROM public.team t
    INNER JOIN public.position_hourly_rate_periods ph
      ON LOWER(TRIM(t.position)) = ph.position_key
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_hourly_rate_periods e WHERE e.employee_email = t.email
    );
  END IF;
END $$;
