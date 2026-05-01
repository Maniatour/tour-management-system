-- 과거 날짜(off_date가 DB 기준 "오늘" 이전)인 오프 스케줄 중 status가 pending인 행을 승인으로 일괄 변경합니다.
-- off_date는 DATE 타입이며, CURRENT_DATE는 PostgreSQL 세션 타임존(보통 UTC) 기준입니다.
-- 한국 영업일 기준이 필요하면 아래 주석의 조건으로 교체하세요.
--
-- 예: 한국 날짜 기준 "오늘 이전"
--   WHERE off_date < ((NOW() AT TIME ZONE 'Asia/Seoul')::date)
--     AND status = 'pending';

UPDATE off_schedules
SET status = 'approved'
WHERE off_date < CURRENT_DATE
  AND status = 'pending';

-- 선택: 과거 대기 건의 승인자를 시스템 구분용 이메일로 남기려면 아래를 사용하고 위 UPDATE는 주석 처리하세요.
-- UPDATE off_schedules
-- SET status = 'approved',
--     approved_by = COALESCE(approved_by, 'migration@past-off-auto-approve')
-- WHERE off_date < CURRENT_DATE
--   AND status = 'pending';
