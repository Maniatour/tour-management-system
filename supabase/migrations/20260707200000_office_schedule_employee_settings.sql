-- Office Schedule 직원별 급여·고용 형태·정기 휴무일

CREATE TABLE IF NOT EXISTS public.office_schedule_employee_settings (
  employee_email VARCHAR(255) PRIMARY KEY,
  pay_type TEXT NOT NULL DEFAULT 'hourly'
    CHECK (pay_type IN ('hourly', 'monthly')),
  employment_type TEXT NOT NULL DEFAULT 'part_time'
    CHECK (employment_type IN ('full_time', 'part_time')),
  rest_days SMALLINT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT office_schedule_employee_settings_rest_days_valid
    CHECK (rest_days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

CREATE INDEX IF NOT EXISTS idx_office_schedule_employee_settings_employment
  ON public.office_schedule_employee_settings (employment_type);

COMMENT ON TABLE public.office_schedule_employee_settings IS
  'Office Schedule 직원 설정: 시간제/월급제, full/part time, 주간 정기 휴무(0=일~6=토)';
COMMENT ON COLUMN public.office_schedule_employee_settings.rest_days IS
  'Full-time 정기 휴무 요일. JS Date.getDay() 기준 0=Sun … 6=Sat';

ALTER TABLE public.office_schedule_employee_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_schedule_employee_settings_select_staff"
  ON public.office_schedule_employee_settings;
CREATE POLICY "office_schedule_employee_settings_select_staff"
  ON public.office_schedule_employee_settings
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "office_schedule_employee_settings_modify_managers"
  ON public.office_schedule_employee_settings;
CREATE POLICY "office_schedule_employee_settings_modify_managers"
  ON public.office_schedule_employee_settings
  FOR ALL TO authenticated
  USING (public.can_edit_all_office_schedule())
  WITH CHECK (public.can_edit_all_office_schedule());

CREATE OR REPLACE FUNCTION public.upsert_office_schedule_employee_settings(
  p_employee_email text,
  p_pay_type text,
  p_employment_type text,
  p_rest_days smallint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  em text := lower(nullif(trim(p_employee_email), ''));
  rd smallint[];
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_edit_all_office_schedule() THEN
    RAISE EXCEPTION 'settings edit requires office manager or super' USING ERRCODE = '42501';
  END IF;
  IF em IS NULL THEN
    RAISE EXCEPTION 'employee_email required';
  END IF;
  IF p_pay_type NOT IN ('hourly', 'monthly') THEN
    RAISE EXCEPTION 'invalid pay_type';
  END IF;
  IF p_employment_type NOT IN ('full_time', 'part_time') THEN
    RAISE EXCEPTION 'invalid employment_type';
  END IF;

  SELECT coalesce(array_agg(d ORDER BY d), '{}'::smallint[])
  INTO rd
  FROM (
    SELECT DISTINCT unnest(coalesce(p_rest_days, '{}'::smallint[])) AS d
  ) s
  WHERE d BETWEEN 0 AND 6;

  IF p_employment_type <> 'full_time' THEN
    rd := '{}'::smallint[];
  END IF;

  INSERT INTO public.office_schedule_employee_settings (
    employee_email,
    pay_type,
    employment_type,
    rest_days,
    updated_at
  )
  VALUES (
    p_employee_email,
    p_pay_type,
    p_employment_type,
    rd,
    now()
  )
  ON CONFLICT (employee_email)
  DO UPDATE SET
    pay_type = EXCLUDED.pay_type,
    employment_type = EXCLUDED.employment_type,
    rest_days = EXCLUDED.rest_days,
    updated_at = now();

  RETURN jsonb_build_object(
    'employee_email', p_employee_email,
    'pay_type', p_pay_type,
    'employment_type', p_employment_type,
    'rest_days', rd
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_office_schedule_employee_settings(text, text, text, smallint[])
  TO authenticated;
