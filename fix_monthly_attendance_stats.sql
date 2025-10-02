-- monthly_attendance_stats 테이블 상태 확인 및 수정

-- 1. 테이블 존재 여부 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'monthly_attendance_stats';

-- 2. 테이블이 없다면 생성
CREATE TABLE IF NOT EXISTS monthly_attendance_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email VARCHAR(255) NOT NULL,
  employee_name VARCHAR(255),
  month DATE NOT NULL,
  total_days INTEGER DEFAULT 0,
  present_days INTEGER DEFAULT 0,
  complete_days INTEGER DEFAULT 0,
  total_work_hours DECIMAL(8,2) DEFAULT 0.00,
  avg_work_hours_per_day DECIMAL(5,2) DEFAULT 0.00,
  first_half_hours DECIMAL(8,2) DEFAULT 0.00,
  second_half_hours DECIMAL(8,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(employee_email, month)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_monthly_stats_employee ON monthly_attendance_stats(employee_email);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_month ON monthly_attendance_stats(month);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_employee_month ON monthly_attendance_stats(employee_email, month);

-- 4. RLS 정책 설정
ALTER TABLE monthly_attendance_stats ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 접근 가능하도록 설정
CREATE POLICY "Allow all authenticated users" ON monthly_attendance_stats 
FOR ALL USING (auth.role() = 'authenticated');

-- 5. 월별 통계 생성 함수
CREATE OR REPLACE FUNCTION generate_monthly_stats(p_employee_email VARCHAR(255), p_month DATE)
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
  FROM team
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
  FROM attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_end
    AND check_in_time IS NOT NULL;
  
  -- 완전한 근무일 수 (출근하고 퇴근까지 완료한 날)
  SELECT COUNT(DISTINCT date)
  INTO v_complete_days
  FROM attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 총 근무시간
  SELECT COALESCE(SUM(work_hours), 0)
  INTO v_total_work_hours
  FROM attendance_records
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
  FROM attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start
    AND date <= v_month_start + INTERVAL '14 days'
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 하반기 근무시간 (16일~말일)
  SELECT COALESCE(SUM(work_hours), 0)
  INTO v_second_half_hours
  FROM attendance_records
  WHERE employee_email = p_employee_email
    AND date >= v_month_start + INTERVAL '15 days'
    AND date <= v_month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
  
  -- 통계 데이터 삽입 또는 업데이트
  INSERT INTO monthly_attendance_stats (
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

-- 6. 기존 데이터로 월별 통계 생성
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- 모든 직원의 모든 월에 대해 통계 생성
  FOR rec IN 
    SELECT DISTINCT employee_email, DATE_TRUNC('month', date)::DATE as month_date
    FROM attendance_records
    WHERE check_in_time IS NOT NULL
  LOOP
    PERFORM generate_monthly_stats(rec.employee_email, rec.month_date);
  END LOOP;
END $$;
