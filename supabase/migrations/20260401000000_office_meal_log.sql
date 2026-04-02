-- 사무실 식사 기록 (4/1~ 출퇴근 정산 시 식사 여부로 30분 차감)
CREATE TABLE IF NOT EXISTS public.office_meal_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_date DATE NOT NULL,
  employee_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (meal_date, employee_email)
);

CREATE INDEX IF NOT EXISTS idx_office_meal_log_meal_date ON public.office_meal_log (meal_date);
CREATE INDEX IF NOT EXISTS idx_office_meal_log_employee_email ON public.office_meal_log (employee_email);

COMMENT ON TABLE public.office_meal_log IS '사무실 식사 여부(일·직원별). 2026-04-01 이후 출퇴근 정산 시 차감에 사용';
COMMENT ON COLUMN public.office_meal_log.meal_date IS '식사한 날 (라스베가스 달력 기준 권장)';
COMMENT ON COLUMN public.office_meal_log.employee_email IS '직원 이메일';

ALTER TABLE public.office_meal_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_meal_log_select_all" ON public.office_meal_log;
DROP POLICY IF EXISTS "office_meal_log_modify_staff" ON public.office_meal_log;

CREATE POLICY "office_meal_log_select_all" ON public.office_meal_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "office_meal_log_modify_staff" ON public.office_meal_log
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
