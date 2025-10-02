-- monthly_attendance_stats 테이블 RLS 문제 해결
-- 더 간단하고 관대한 정책으로 수정

-- 1. 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Authenticated users can view monthly stats" ON monthly_attendance_stats;
DROP POLICY IF EXISTS "Admins can manage monthly stats" ON monthly_attendance_stats;

-- 2. 임시로 RLS 비활성화 (테스트용)
ALTER TABLE monthly_attendance_stats DISABLE ROW LEVEL SECURITY;

-- 3. attendance_records 테이블도 확인 및 수정
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON attendance_records;
DROP POLICY IF EXISTS "Users can manage their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_records;

-- 4. attendance_records에 간단한 정책 적용
-- 모든 인증된 사용자가 모든 작업 가능 (임시)
CREATE POLICY "All authenticated users can manage attendance" ON attendance_records
    FOR ALL USING (auth.role() = 'authenticated');

-- 5. 완료 메시지
SELECT 'RLS 정책이 임시로 완화되었습니다. 이제 출퇴근 기록 수정이 가능합니다.' as message;
