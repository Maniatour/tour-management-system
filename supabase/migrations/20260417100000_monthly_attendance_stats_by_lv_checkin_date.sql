-- 월별 통계(상·하반기 포함)를 attendance_records.date가 아니라
-- 출근 시각(check_in_time)의 America/Los_Angeles 달력일 기준으로 계산합니다.
-- 앱의 lasVegasDateFromCheckIn / calendarDateFromAttendanceRecord 와 동일한 기준.

CREATE OR REPLACE FUNCTION public.calculate_monthly_attendance_stats(
  p_employee_email VARCHAR(255),
  p_month DATE
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
    AND ar.check_in_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  SELECT COUNT(DISTINCT (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)
  INTO v_complete_days
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  SELECT COALESCE(SUM(ar.work_hours), 0)
  INTO v_total_work_hours
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
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
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_start + INTERVAL '14 days';

  SELECT COALESCE(SUM(ar.work_hours), 0)
  INTO v_second_half_hours
  FROM public.attendance_records ar
  WHERE ar.employee_email = p_employee_email
    AND ar.check_in_time IS NOT NULL
    AND ar.check_out_time IS NOT NULL
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= v_month_start + INTERVAL '15 days'
    AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE <= v_month_end;

  INSERT INTO public.monthly_attendance_stats (
    employee_email,
    employee_name,
    month,
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
    v_total_days,
    v_present_days,
    v_complete_days,
    v_total_work_hours,
    v_avg_work_hours,
    v_first_half_hours,
    v_second_half_hours
  )
  ON CONFLICT (employee_email, month)
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
BEGIN
  IF TG_OP = 'DELETE' THEN
    emp := OLD.employee_email;
    IF OLD.check_in_time IS NOT NULL THEN
      m_old := DATE_TRUNC('month', (OLD.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)::DATE;
      PERFORM public.calculate_monthly_attendance_stats(emp, m_old);
    ELSE
      PERFORM public.calculate_monthly_attendance_stats(emp, DATE_TRUNC('month', OLD.date)::DATE);
    END IF;
    RETURN OLD;
  END IF;

  emp := NEW.employee_email;

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
      PERFORM public.calculate_monthly_attendance_stats(emp, m_old);
      PERFORM public.calculate_monthly_attendance_stats(emp, m_new);
    ELSE
      PERFORM public.calculate_monthly_attendance_stats(emp, m_new);
    END IF;
  ELSE
    PERFORM public.calculate_monthly_attendance_stats(emp, m_new);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON COLUMN public.monthly_attendance_stats.first_half_hours IS '상반기 근무시간 (1~15일, 출근 시각 LV 달력일 기준)';
COMMENT ON COLUMN public.monthly_attendance_stats.second_half_hours IS '하반기 근무시간 (16일~말일, 출근 시각 LV 달력일 기준)';

-- 2026-01-01 이후 출근이 있는 (직원 × 월) 조합만 재계산 (기존 통계 행 갱신)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      ar.employee_email,
      DATE_TRUNC('month', (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE)::DATE AS m
    FROM public.attendance_records ar
    WHERE ar.check_in_time IS NOT NULL
      AND (ar.check_in_time AT TIME ZONE 'America/Los_Angeles')::DATE >= DATE '2026-01-01'
  LOOP
    PERFORM public.calculate_monthly_attendance_stats(r.employee_email, r.m);
  END LOOP;
END $$;
