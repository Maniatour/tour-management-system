-- Phase 6b.2: operator_id on attendance_records + monthly_attendance_stats
-- Backfill Kovegas. Update stats RPC/trigger to scope by operator_id.
-- No schema rename/move; team table unchanged.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attendance_records' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.attendance_records ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.attendance_records SET operator_id = kovegas WHERE operator_id IS NULL;

  ALTER TABLE public.attendance_records
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.attendance_records
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.attendance_records
      ADD CONSTRAINT attendance_records_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'monthly_attendance_stats'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.monthly_attendance_stats ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.monthly_attendance_stats SET operator_id = kovegas WHERE operator_id IS NULL;

  ALTER TABLE public.monthly_attendance_stats
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.monthly_attendance_stats
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.monthly_attendance_stats
      ADD CONSTRAINT monthly_attendance_stats_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- Replace UNIQUE(employee_email, month) with tenant-scoped unique
  ALTER TABLE public.monthly_attendance_stats
    DROP CONSTRAINT IF EXISTS monthly_attendance_stats_employee_email_month_key;

  BEGIN
    ALTER TABLE public.monthly_attendance_stats
      ADD CONSTRAINT monthly_attendance_stats_operator_email_month_key
      UNIQUE (operator_id, employee_email, month);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_records_operator_id
  ON public.attendance_records (operator_id);

CREATE INDEX IF NOT EXISTS idx_monthly_attendance_stats_operator_id
  ON public.monthly_attendance_stats (operator_id);

CREATE OR REPLACE FUNCTION public.calculate_monthly_attendance_stats(
  p_employee_email VARCHAR(255),
  p_month DATE,
  p_operator_id UUID DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid
)
RETURNS VOID AS $$
DECLARE
  v_employee_name VARCHAR(255);
  v_total_days INTEGER;
  v_present_days INTEGER;
  v_complete_days INTEGER;
  v_total_work_hours DECIMAL(8,2);
  v_avg_work_hours DECIMAL(5,2);
  v_first_half_hours DECIMAL(8,2);
  v_second_half_hours DECIMAL(8,2);
  v_month_start DATE;
  v_month_end DATE;
  v_operator_id UUID := COALESCE(p_operator_id, 'a0000000-0000-4000-8000-000000000001'::uuid);
BEGIN
  SELECT name_ko INTO v_employee_name
  FROM public.team
  WHERE email = p_employee_email AND is_active = true
  LIMIT 1;

  IF v_employee_name IS NULL THEN
    RETURN;
  END IF;

  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  v_total_days := EXTRACT(DAY FROM v_month_end);

  SELECT COUNT(DISTINCT (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)
  INTO v_present_days
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.operator_id = v_operator_id
    AND ar.check_in_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  SELECT COUNT(DISTINCT (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)
  INTO v_complete_days
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.operator_id = v_operator_id
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  SELECT COALESCE(SUM(ar.work_hours), 0)
  INTO v_total_work_hours
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.operator_id = v_operator_id
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  v_avg_work_hours := CASE
    WHEN v_complete_days > 0 THEN v_total_work_hours / v_complete_days
    ELSE 0
  END;

  SELECT COALESCE(SUM(ar.work_hours), 0)
  INTO v_first_half_hours
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.operator_id = v_operator_id
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_start + INTERVAL '14 days';

  SELECT COALESCE(SUM(ar.work_hours), 0)
  INTO v_second_half_hours
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.operator_id = v_operator_id
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start + INTERVAL '15 days'
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  INSERT INTO public.monthly_attendance_stats (
    employee_email,
    employee_name,
    month,
    operator_id,
    total_days,
    present_days,
    complete_days,
    total_work_hours,
    avg_work_hours_per_day,
    first_half_hours,
    second_half_hours
  ) VALUES (
    p_employee_email,
    v_employee_name,
    v_month_start,
    v_operator_id,
    v_total_days,
    v_present_days,
    v_complete_days,
    v_total_work_hours,
    v_avg_work_hours,
    v_first_half_hours,
    v_second_half_hours
  )
  ON CONFLICT (operator_id, employee_email, month)
  DO UPDATE SET
    employee_name = EXCLUDED.employee_name,
    total_days = EXCLUDED.total_days,
    present_days = EXCLUDED.present_days,
    complete_days = EXCLUDED.complete_days,
    total_work_hours = EXCLUDED.total_work_hours,
    avg_work_hours_per_day = EXCLUDED.avg_work_hours_per_day,
    first_half_hours = EXCLUDED.first_half_hours,
    second_half_hours = EXCLUDED.second_half_hours,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_monthly_stats_on_attendance_change()
RETURNS TRIGGER AS $$
DECLARE
  m_old DATE;
  m_new DATE;
  emp TEXT;
  op UUID;
  kovegas UUID := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    emp := OLD.employee_email;
    op := COALESCE(OLD.operator_id, kovegas);
    IF OLD.check_in_time IS NOT NULL THEN
      m_old := DATE_TRUNC('month', (OLD.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)::DATE;
      PERFORM public.calculate_monthly_attendance_stats(emp, m_old, op);
    ELSE
      PERFORM public.calculate_monthly_attendance_stats(emp, DATE_TRUNC('month', OLD.date)::DATE, op);
    END IF;
    RETURN OLD;
  END IF;

  emp := NEW.employee_email;
  op := COALESCE(NEW.operator_id, kovegas);

  IF NEW.check_in_time IS NOT NULL THEN
    m_new := DATE_TRUNC('month', (NEW.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)::DATE;
  ELSE
    m_new := DATE_TRUNC('month', NEW.date)::DATE;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.check_in_time IS NOT NULL THEN
      m_old := DATE_TRUNC('month', (OLD.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)::DATE;
    ELSE
      m_old := DATE_TRUNC('month', OLD.date)::DATE;
    END IF;

    IF m_old IS NOT NULL AND m_new IS NOT NULL AND m_old <> m_new THEN
      PERFORM public.calculate_monthly_attendance_stats(emp, m_old, COALESCE(OLD.operator_id, op));
      PERFORM public.calculate_monthly_attendance_stats(emp, m_new, op);
    ELSE
      PERFORM public.calculate_monthly_attendance_stats(emp, m_new, op);
    END IF;
  ELSE
    PERFORM public.calculate_monthly_attendance_stats(emp, m_new, op);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.attendance_records.operator_id IS
  'SaaS tenant owning this attendance session. Phase 6b.2.';

COMMENT ON COLUMN public.monthly_attendance_stats.operator_id IS
  'SaaS tenant owning this monthly attendance aggregate. Phase 6b.2.';
