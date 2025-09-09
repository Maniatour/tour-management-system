-- 출퇴근 기록 테이블에 session_number 컬럼 추가
-- 2025-01-01 출퇴근 관리 시스템 개선

-- attendance_records 테이블이 존재하는지 확인하고 session_number 컬럼 추가
DO $$ 
BEGIN
    -- 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attendance_records') THEN
        -- session_number 컬럼이 존재하지 않으면 추가
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'attendance_records' 
            AND column_name = 'session_number'
        ) THEN
            ALTER TABLE attendance_records ADD COLUMN session_number INTEGER DEFAULT 1;
        END IF;
        
        -- 기존 유니크 제약조건 제거 (employee_email, date)
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'attendance_records' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%employee_email%'
        ) THEN
            ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_employee_email_date_key;
        END IF;
        
        -- 새로운 유니크 제약조건 추가 (employee_email, date, session_number)
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'attendance_records' 
            AND constraint_type = 'UNIQUE'
            AND constraint_name = 'attendance_records_employee_email_date_session_number_key'
        ) THEN
            ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_employee_email_date_session_number_key 
            UNIQUE(employee_email, date, session_number);
        END IF;
    END IF;
END $$;
