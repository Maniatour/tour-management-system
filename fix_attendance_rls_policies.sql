-- attendance_records 테이블 RLS 정책 확인 및 수정
-- monthly_attendance_stats 관련 오류 해결

-- 1. 현재 attendance_records 테이블의 RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'attendance_records';

-- 2. monthly_attendance_stats 테이블의 RLS 정책 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'monthly_attendance_stats';

-- 3. attendance_records 테이블의 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Users can manage their own attendance" ON attendance_records;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON attendance_records;
DROP POLICY IF EXISTS "Authenticated users can view attendance" ON attendance_records;

-- 4. 새로운 RLS 정책 생성 (team 테이블 기반)
-- 모든 인증된 사용자가 조회 가능
CREATE POLICY "Authenticated users can view attendance" ON attendance_records
    FOR SELECT USING (auth.role() = 'authenticated');

-- 사용자는 자신의 출퇴근 기록만 수정 가능
CREATE POLICY "Users can manage their own attendance" ON attendance_records
    FOR ALL USING (
        employee_email = auth.jwt() ->> 'email'
    );

-- 관리자는 모든 출퇴근 기록 관리 가능
CREATE POLICY "Admins can manage all attendance" ON attendance_records
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM team 
            WHERE team.email = auth.jwt() ->> 'email' 
            AND team.is_active = true 
            AND team.position IN ('super', 'admin', 'op')
        )
    );

-- 5. monthly_attendance_stats 테이블의 기존 RLS 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can view monthly stats" ON monthly_attendance_stats;
DROP POLICY IF EXISTS "Admins can manage monthly stats" ON monthly_attendance_stats;

-- 6. monthly_attendance_stats 테이블의 새로운 RLS 정책 생성
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

-- 7. 완료 메시지
SELECT 'attendance_records 및 monthly_attendance_stats RLS 정책이 성공적으로 수정되었습니다.' as message;
