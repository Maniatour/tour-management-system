-- monthly_attendance_stats 테이블 완전 재생성
-- 기존 테이블과 관련 객체들을 모두 삭제하고 새로 생성

-- 1. 기존 테이블과 관련 객체들 삭제
DROP TABLE IF EXISTS monthly_attendance_stats CASCADE;

-- 2. monthly_attendance_stats 테이블 생성
CREATE TABLE monthly_attendance_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_email TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    month DATE NOT NULL,
    total_days INTEGER NOT NULL DEFAULT 0,
    present_days INTEGER NOT NULL DEFAULT 0,
    complete_days INTEGER NOT NULL DEFAULT 0,
    total_work_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    avg_work_hours_per_day DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    first_half_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    second_half_hours DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 유니크 제약조건: 한 직원당 한 달에 하나의 통계만
    UNIQUE(employee_email, month)
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_monthly_stats_employee_email ON monthly_attendance_stats(employee_email);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_month ON monthly_attendance_stats(month);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_employee_month ON monthly_attendance_stats(employee_email, month);

-- 4. RLS 활성화
ALTER TABLE monthly_attendance_stats ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 생성
-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Authenticated users can view monthly stats" ON monthly_attendance_stats
    FOR SELECT USING (auth.role() = 'authenticated');

-- 관리자만 삽입/수정/삭제 가능
CREATE POLICY "Admins can manage monthly stats" ON monthly_attendance_stats
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team 
            WHERE team.email = auth.jwt() ->> 'email' 
            AND team.is_active = true 
            AND team.position IN ('super', 'admin', 'op')
        )
    );

-- 6. 월별 통계 생성 함수
CREATE OR REPLACE FUNCTION generate_monthly_stats(
    p_employee_email TEXT,
    p_month DATE
) RETURNS VOID AS $$
DECLARE
    month_start DATE;
    month_end DATE;
    total_days INTEGER;
    present_days INTEGER;
    complete_days INTEGER;
    total_work_hours DECIMAL(10,2);
    avg_work_hours DECIMAL(10,2);
    first_half_hours DECIMAL(10,2);
    second_half_hours DECIMAL(10,2);
    employee_name TEXT;
BEGIN
    -- 월의 시작일과 마지막일 계산
    month_start := DATE_TRUNC('month', p_month)::DATE;
    month_end := (DATE_TRUNC('month', p_month) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    
    -- 해당 월의 총 일수
    total_days := EXTRACT(DAY FROM month_end);
    
    -- 직원 이름 조회
    SELECT name_ko INTO employee_name
    FROM team 
    WHERE email = p_employee_email AND is_active = true;
    
    IF employee_name IS NULL THEN
        RAISE EXCEPTION 'Employee not found: %', p_employee_email;
    END IF;
    
    -- 출근한 일수 계산
    SELECT COUNT(DISTINCT date) INTO present_days
    FROM attendance_records
    WHERE employee_email = p_employee_email
    AND date >= month_start
    AND date <= month_end
    AND check_in_time IS NOT NULL;
    
    -- 완전한 근무일 수 계산 (출근하고 퇴근한 날)
    SELECT COUNT(DISTINCT date) INTO complete_days
    FROM attendance_records
    WHERE employee_email = p_employee_email
    AND date >= month_start
    AND date <= month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
    
    -- 총 근무시간 계산
    SELECT COALESCE(SUM(work_hours), 0) INTO total_work_hours
    FROM attendance_records
    WHERE employee_email = p_employee_email
    AND date >= month_start
    AND date <= month_end
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
    
    -- 평균 근무시간 계산
    IF complete_days > 0 THEN
        avg_work_hours := total_work_hours / complete_days;
    ELSE
        avg_work_hours := 0;
    END IF;
    
    -- 상반기 근무시간 (1일~15일)
    SELECT COALESCE(SUM(work_hours), 0) INTO first_half_hours
    FROM attendance_records
    WHERE employee_email = p_employee_email
    AND date >= month_start
    AND date <= month_start + INTERVAL '14 days'
    AND check_in_time IS NOT NULL
    AND check_out_time IS NOT NULL;
    
    -- 하반기 근무시간 (16일~말일)
    SELECT COALESCE(SUM(work_hours), 0) INTO second_half_hours
    FROM attendance_records
    WHERE employee_email = p_employee_email
    AND date >= month_start + INTERVAL '15 days'
    AND date <= month_end
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
        second_half_hours,
        updated_at
    ) VALUES (
        p_employee_email,
        employee_name,
        month_start,
        total_days,
        present_days,
        complete_days,
        total_work_hours,
        avg_work_hours,
        first_half_hours,
        second_half_hours,
        NOW()
    )
    ON CONFLICT (employee_email, month)
    DO UPDATE SET
        total_days = EXCLUDED.total_days,
        present_days = EXCLUDED.present_days,
        complete_days = EXCLUDED.complete_days,
        total_work_hours = EXCLUDED.total_work_hours,
        avg_work_hours_per_day = EXCLUDED.avg_work_hours_per_day,
        first_half_hours = EXCLUDED.first_half_hours,
        second_half_hours = EXCLUDED.second_half_hours,
        updated_at = NOW();
        
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. 기존 데이터가 있다면 월별 통계 재생성
-- 모든 활성 직원의 현재 월 통계 생성
DO $$
DECLARE
    emp_record RECORD;
    current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
BEGIN
    FOR emp_record IN 
        SELECT DISTINCT employee_email 
        FROM attendance_records 
        WHERE date >= current_month
    LOOP
        PERFORM generate_monthly_stats(emp_record.employee_email, current_month);
    END LOOP;
END $$;

-- 8. 완료 메시지
SELECT 'monthly_attendance_stats 테이블이 성공적으로 생성되었습니다.' as message;
