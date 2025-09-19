-- 출퇴근 관리 테이블 생성

-- 필요한 함수들 먼저 생성
-- 1) current_email(): JWT에서 이메일 추출
CREATE OR REPLACE FUNCTION public.current_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
  ));
$$;

-- 2) is_staff(): team 테이블 또는 화이트리스트 기반 스태프 판별
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.is_staff(public.current_email());
$$;

-- 3) is_staff(email): 특정 이메일이 스태프인지 확인
CREATE OR REPLACE FUNCTION public.is_staff(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    exists(
      SELECT 1 FROM public.team t
      WHERE lower(t.email) = lower(p_email) AND coalesce(t.is_active, true) = true
    )
    or lower(coalesce(p_email, '')) in ('info@maniatour.com','wooyong.shim09@gmail.com')
  , false);
$$;

-- 4) update_updated_at_column(): updated_at 자동 갱신 트리거 함수
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 1. attendance_records 테이블 생성
-- 기존 테이블이 있다면 삭제
DROP TABLE IF EXISTS public.attendance_records CASCADE;

CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  work_hours DECIMAL(5,2) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
  notes TEXT,
  session_number INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 복합 인덱스를 위한 유니크 제약조건
  UNIQUE(employee_email, date, session_number)
);

-- 인덱스 생성
CREATE INDEX idx_attendance_records_employee_email ON public.attendance_records(employee_email);
CREATE INDEX idx_attendance_records_date ON public.attendance_records(date);
CREATE INDEX idx_attendance_records_employee_date ON public.attendance_records(employee_email, date);
CREATE INDEX idx_attendance_records_status ON public.attendance_records(status);

-- 2. monthly_attendance_stats 테이블 생성 (월별 통계용)
-- 기존 뷰나 테이블이 있다면 삭제
DROP VIEW IF EXISTS public.monthly_attendance_stats CASCADE;
DROP TABLE IF EXISTS public.monthly_attendance_stats CASCADE;

CREATE TABLE public.monthly_attendance_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_email VARCHAR(255) NOT NULL,
  employee_name VARCHAR(255) NOT NULL,
  month DATE NOT NULL, -- YYYY-MM-01 형식으로 저장
  total_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  complete_days INTEGER DEFAULT 0, -- 출근하고 퇴근까지 완료한 날
  total_work_hours DECIMAL(8,2) DEFAULT 0.00,
  avg_work_hours_per_day DECIMAL(5,2) DEFAULT 0.00,
  first_half_hours DECIMAL(8,2) DEFAULT 0.00, -- 1~15일 근무시간
  second_half_hours DECIMAL(8,2) DEFAULT 0.00, -- 16일~말일 근무시간
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- 한 직원당 한 달에 하나의 통계만
  UNIQUE(employee_email, month)
);

-- 인덱스 생성
CREATE INDEX idx_monthly_attendance_stats_employee_email ON public.monthly_attendance_stats(employee_email);
CREATE INDEX idx_monthly_attendance_stats_month ON public.monthly_attendance_stats(month);
CREATE INDEX idx_monthly_attendance_stats_employee_month ON public.monthly_attendance_stats(employee_email, month);

-- 3. RLS 활성화
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_attendance_stats ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 설정
-- attendance_records 테이블 정책
DROP POLICY IF EXISTS "attendance_records_select_all" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_modify_staff_only" ON public.attendance_records;

-- 모든 사용자가 자신의 출퇴근 기록 조회 가능
CREATE POLICY "attendance_records_select_own" ON public.attendance_records
  FOR SELECT
  USING (employee_email = auth.jwt() ->> 'email');

-- staff만 출퇴근 기록 수정 가능
CREATE POLICY "attendance_records_modify_staff_only" ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- monthly_attendance_stats 테이블 정책
DROP POLICY IF EXISTS "monthly_attendance_stats_select_own" ON public.monthly_attendance_stats;
DROP POLICY IF EXISTS "monthly_attendance_stats_modify_staff_only" ON public.monthly_attendance_stats;

-- 모든 사용자가 자신의 월별 통계 조회 가능
CREATE POLICY "monthly_attendance_stats_select_own" ON public.monthly_attendance_stats
  FOR SELECT
  USING (employee_email = auth.jwt() ->> 'email');

-- staff만 월별 통계 수정 가능
CREATE POLICY "monthly_attendance_stats_modify_staff_only" ON public.monthly_attendance_stats
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 5. updated_at 자동 갱신 트리거 설정 (함수는 이미 위에서 생성됨)

-- attendance_records 트리거
DROP TRIGGER IF EXISTS update_attendance_records_updated_at ON public.attendance_records;
CREATE TRIGGER update_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- monthly_attendance_stats 트리거
DROP TRIGGER IF EXISTS update_monthly_attendance_stats_updated_at ON public.monthly_attendance_stats;
CREATE TRIGGER update_monthly_attendance_stats_updated_at
  BEFORE UPDATE ON public.monthly_attendance_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. 월별 통계 자동 계산 함수
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
  -- 직원 이름 조회
  SELECT name_ko INTO v_employee_name
  FROM public.team
  WHERE email = p_employee_email AND is_active = true
  LIMIT 1;
  
  IF v_employee_name IS NULL THEN
    RETURN;
  END IF;
  
  -- 월의 시작일과 마지막일 계산
  v_month_start := DATE_TRUNC('month', p_month)::DATE;
  v_month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  
  -- 해당 월의 총 일수
  v_total_days := EXTRACT(DAY FROM v_month_end);
  
  -- 출근한 날 수 (check_in_time이 있는 날)
  SELECT COUNT(DISTINCT date)
  INTO v_present_days
  FROM public.attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_end
    AND check_in_time IS NOT NULL;
  
  -- 완전한 근무일 수 (출근하고 퇴근까지 완료한 날)
  SELECT COUNT(DISTINCT date)
  INTO v_complete_days
  FROM public.attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 총 근무시간
  SELECT COALESCE(SUM(work_hours), 0)
  INTO v_total_work_hours
  FROM public.attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 평균 근무시간
  v_avg_work_hours := CASE 
    WHEN v_complete_days > 0 THEN v_total_work_hours / v_complete_days
    ELSE 0
  END;
  
  -- 상반기 근무시간 (1~15일)
  SELECT COALESCE(SUM(work_hours), 0)
  INTO v_first_half_hours
  FROM public.attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_start + INTERVAL '14 days'
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 하반기 근무시간 (16일~말일)
  SELECT COALESCE(SUM(work_hours), 0)
  INTO v_second_half_hours
  FROM public.attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start + INTERVAL '15 days'
    AND date <= v_month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 통계 데이터 삽입 또는 업데이트
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

-- 7. 출퇴근 기록 업데이트 시 월별 통계 자동 갱신 트리거
CREATE OR REPLACE FUNCTION public.update_monthly_stats_on_attendance_change()
RETURNS TRIGGER AS $$
DECLARE
  v_month_start DATE;
BEGIN
  -- 변경된 기록의 월 계산
  v_month_start := DATE_TRUNC('month', COALESCE(NEW.date, OLD.date))::DATE;
  
  -- 해당 직원의 해당 월 통계 재계산
  PERFORM public.calculate_monthly_attendance_stats(
    COALESCE(NEW.employee_email, OLD.employee_email),
    v_month_start
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_monthly_stats_on_attendance_change ON public.attendance_records;
CREATE TRIGGER trigger_update_monthly_stats_on_attendance_change
  AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.update_monthly_stats_on_attendance_change();

-- 8. 테이블 코멘트 추가
COMMENT ON TABLE public.attendance_records IS '직원 출퇴근 기록';
COMMENT ON TABLE public.monthly_attendance_stats IS '직원 월별 출퇴근 통계';

COMMENT ON COLUMN public.attendance_records.employee_email IS '직원 이메일';
COMMENT ON COLUMN public.attendance_records.date IS '출퇴근 날짜';
COMMENT ON COLUMN public.attendance_records.check_in_time IS '출근 시간';
COMMENT ON COLUMN public.attendance_records.check_out_time IS '퇴근 시간';
COMMENT ON COLUMN public.attendance_records.work_hours IS '근무 시간 (시간 단위)';
COMMENT ON COLUMN public.attendance_records.status IS '출근 상태 (present, late, absent)';
COMMENT ON COLUMN public.attendance_records.session_number IS '해당 날짜의 세션 번호 (하루에 여러 번 출퇴근 가능)';

COMMENT ON COLUMN public.monthly_attendance_stats.employee_email IS '직원 이메일';
COMMENT ON COLUMN public.monthly_attendance_stats.employee_name IS '직원 이름';
COMMENT ON COLUMN public.monthly_attendance_stats.month IS '통계 월 (YYYY-MM-01 형식)';
COMMENT ON COLUMN public.monthly_attendance_stats.total_days IS '해당 월 총 일수';
COMMENT ON COLUMN public.monthly_attendance_stats.present_days IS '출근한 날 수';
COMMENT ON COLUMN public.monthly_attendance_stats.complete_days IS '완전한 근무일 수 (출근+퇴근)';
COMMENT ON COLUMN public.monthly_attendance_stats.total_work_hours IS '총 근무시간';
COMMENT ON COLUMN public.monthly_attendance_stats.avg_work_hours_per_day IS '일평균 근무시간';
COMMENT ON COLUMN public.monthly_attendance_stats.first_half_hours IS '상반기 근무시간 (1~15일)';
COMMENT ON COLUMN public.monthly_attendance_stats.second_half_hours IS '하반기 근무시간 (16일~말일)';
