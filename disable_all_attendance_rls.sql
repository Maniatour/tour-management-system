-- 모든 출퇴근 관련 테이블의 RLS 완전 비활성화
-- 디버깅 및 테스트용

-- 1. attendance_records 테이블 RLS 비활성화
ALTER TABLE attendance_records DISABLE ROW LEVEL SECURITY;

-- 2. monthly_attendance_stats 테이블 RLS 비활성화
ALTER TABLE monthly_attendance_stats DISABLE ROW LEVEL SECURITY;

-- 3. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "All authenticated users can manage attendance" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can manage their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_records;

DROP POLICY IF EXISTS "Authenticated users can view monthly stats" ON monthly_attendance_stats;
DROP POLICY IF EXISTS "Admins can manage monthly stats" ON monthly_attendance_stats;

-- 4. 완료 메시지
SELECT '모든 출퇴근 관련 테이블의 RLS가 비활성화되었습니다. 이제 모든 작업이 가능합니다.' as message;
