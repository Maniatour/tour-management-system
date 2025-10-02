-- 출퇴근 근무시간 계산 트리거 수정

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS calculate_work_hours_trigger ON attendance_records;

-- 근무시간 계산 함수 수정
CREATE OR REPLACE FUNCTION calculate_work_hours()
RETURNS TRIGGER AS $$
BEGIN
    -- check_in_time과 check_out_time이 모두 있을 때만 계산
    IF NEW.check_in_time IS NOT NULL AND NEW.check_out_time IS NOT NULL THEN
        -- 초 단위로 차이 계산 후 시간으로 변환
        NEW.work_hours = EXTRACT(EPOCH FROM (NEW.check_out_time - NEW.check_in_time)) / 3600.0;
        
        -- 소수점 둘째 자리까지 반올림
        NEW.work_hours = ROUND(NEW.work_hours, 2);
    ELSE
        NEW.work_hours = 0.00;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 재생성
CREATE TRIGGER calculate_work_hours_trigger
    BEFORE INSERT OR UPDATE ON attendance_records
    FOR EACH ROW
    EXECUTE FUNCTION calculate_work_hours();

-- 기존 데이터의 work_hours 업데이트 (check_out_time이 있는 기록들)
UPDATE attendance_records 
SET work_hours = ROUND(EXTRACT(EPOCH FROM (check_out_time - check_in_time)) / 3600.0, 2)
WHERE check_in_time IS NOT NULL 
  AND check_out_time IS NOT NULL 
  AND work_hours = 0.00;
