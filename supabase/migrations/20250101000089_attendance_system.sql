-- 출퇴근 관리 시스템
-- 2025-01-01 출퇴근 관리 시스템 생성

-- team 테이블에 샘플 데이터가 있는지 확인하고 없으면 추가
INSERT INTO team (email, name_ko, name_en, phone, position, languages, is_active) VALUES
('guide@tour.com', '김가이드', 'Kim Guide', '010-1234-5678', '투어 가이드', ARRAY['ko', 'en'], true),
('manager@tour.com', '박매니저', 'Park Manager', '010-2345-6789', '팀 매니저', ARRAY['ko', 'en'], true),
('driver@tour.com', '이드라이버', 'Lee Driver', '010-3456-7890', '전용 운전기사', ARRAY['ko'], true)
ON CONFLICT (email) DO NOTHING;

-- 출퇴근 기록 테이블 생성
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_email VARCHAR(255) REFERENCES team(email) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_out_time TIMESTAMP WITH TIME ZONE,
  work_hours DECIMAL(4,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day')),
  notes TEXT,
  session_number INTEGER DEFAULT 1, -- 같은 날의 몇 번째 출퇴근인지 (1, 2, 3...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(employee_email, date, session_number)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_email);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_email, date);

-- RLS 활성화
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (모든 사용자가 읽기/쓰기 가능)
CREATE POLICY "Enable all access for attendance_records" ON attendance_records FOR ALL USING (true);

-- 근무시간 계산 함수
CREATE OR REPLACE FUNCTION calculate_work_hours()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        NEW.work_hours = EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600;
    ELSE
        NEW.work_hours = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'calculate_work_hours_trigger'
    ) THEN
        CREATE TRIGGER calculate_work_hours_trigger
            BEFORE INSERT OR UPDATE ON attendance_records
            FOR EACH ROW
            EXECUTE FUNCTION calculate_work_hours();
    END IF;
END $$;

-- 월별 출퇴근 통계 뷰 (기존 뷰 삭제 후 재생성)
DROP VIEW IF EXISTS monthly_attendance_stats;
CREATE VIEW monthly_attendance_stats AS
SELECT 
    ar.employee_email,
    t.name_ko as employee_name,
    DATE_TRUNC('month', ar.date)::date as month,
    COUNT(*) as total_days,
    SUM(ar.work_hours) as total_hours,
    AVG(ar.work_hours) as avg_work_hours_per_day,
    SUM(CASE WHEN EXTRACT(DAY FROM ar.date) <= 15 THEN ar.work_hours ELSE 0 END) as first_half_hours,
    SUM(CASE WHEN EXTRACT(DAY FROM ar.date) > 15 THEN ar.work_hours ELSE 0 END) as second_half_hours
FROM attendance_records ar
JOIN team t ON ar.employee_email = t.email
WHERE ar.check_out_time IS NOT NULL
GROUP BY ar.employee_email, t.name_ko, DATE_TRUNC('month', ar.date);

-- 일별 출퇴근 뷰 (기존 뷰 삭제 후 재생성)
DROP VIEW IF EXISTS daily_attendance_view;
CREATE VIEW daily_attendance_view AS
SELECT 
    ar.id,
    ar.employee_email,
    t.name_ko as employee_name,
    ar.date,
    ar.check_in_time,
    ar.check_out_time,
    ar.work_hours,
    ar.status,
    ar.notes,
    ar.session_number,
    CASE 
        WHEN ar.check_in_time IS NULL THEN 'not_started'
        WHEN ar.check_out_time IS NULL THEN 'in_progress'
        ELSE 'completed'
    END as work_status,
    CASE 
        WHEN ar.check_in_time::time > '09:00:00' THEN 'late'
        ELSE 'on_time'
    END as punctuality_status
FROM attendance_records ar
JOIN team t ON ar.employee_email = t.email;

-- 샘플 데이터 (테스트용)
INSERT INTO attendance_records (employee_email, date, check_in_time, check_out_time, status, session_number) VALUES
(
  'guide@tour.com',
  CURRENT_DATE - INTERVAL '1 day',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '09:00:00',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '18:00:00',
  'present',
  1
),
(
  'manager@tour.com',
  CURRENT_DATE - INTERVAL '1 day',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '08:30:00',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '17:30:00',
  'present',
  1
),
(
  'driver@tour.com',
  CURRENT_DATE - INTERVAL '1 day',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '09:15:00',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '18:15:00',
  'late',
  1
)
ON CONFLICT (employee_email, date, session_number) DO NOTHING;
