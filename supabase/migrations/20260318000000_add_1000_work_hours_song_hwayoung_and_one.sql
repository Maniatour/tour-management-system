-- 송화영과 한 명(하나)에게 각각 근무시간 1000시간 추가
-- team.name_ko = '송화영', '하나' 인 직원의 employee_email로 attendance_records에 100시간 x 10일 삽입

INSERT INTO attendance_records (employee_email, date, check_in_time, check_out_time, work_hours, status, session_number)
SELECT t.email, d.dt::date,
       (d.dt::date || ' 00:00:00')::timestamptz,
       (d.dt::date || ' 00:00:00')::timestamptz + interval '100 hours',
       100.00, 'present', 1
FROM team t
CROSS JOIN (
  SELECT generate_series(
    '2024-01-01'::date,
    '2024-01-10'::date,
    '1 day'::interval
  )::date AS dt
) d
WHERE t.name_ko IN ('송화영', '하나')
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.employee_email = t.email AND ar.date = d.dt::date AND ar.session_number = 1
  )
ON CONFLICT (employee_email, date, session_number) DO NOTHING;
