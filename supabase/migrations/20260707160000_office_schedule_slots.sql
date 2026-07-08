-- 사무실 근무 스케줄 (출퇴근 관리 Office Schedule)
CREATE TABLE IF NOT EXISTS public.office_schedule_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email VARCHAR(255) NOT NULL,
  schedule_date DATE NOT NULL,
  hour_slot SMALLINT NOT NULL CHECK (hour_slot >= 0 AND hour_slot <= 23),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_email, schedule_date, hour_slot)
);

CREATE INDEX IF NOT EXISTS idx_office_schedule_slots_date
  ON public.office_schedule_slots (schedule_date);

CREATE INDEX IF NOT EXISTS idx_office_schedule_slots_employee
  ON public.office_schedule_slots (employee_email);

CREATE INDEX IF NOT EXISTS idx_office_schedule_slots_employee_date
  ON public.office_schedule_slots (employee_email, schedule_date);

COMMENT ON TABLE public.office_schedule_slots IS '사무실 직원 시간대별 근무 스케줄 (0~23시, 일·직원·시간대별)';
COMMENT ON COLUMN public.office_schedule_slots.hour_slot IS '시간대: 0=0:00~9:00 블록, 9~23=해당 시 시작 1시간(9=9:00~10:00)';
COMMENT ON COLUMN public.office_schedule_slots.note IS '셀 메모 (선택)';

ALTER TABLE public.office_schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_schedule_slots_select_all" ON public.office_schedule_slots;
DROP POLICY IF EXISTS "office_schedule_slots_modify_staff" ON public.office_schedule_slots;

CREATE POLICY "office_schedule_slots_select_all" ON public.office_schedule_slots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "office_schedule_slots_modify_staff" ON public.office_schedule_slots
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());
