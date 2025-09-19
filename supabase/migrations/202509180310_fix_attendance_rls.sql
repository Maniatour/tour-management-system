-- 출퇴근 테이블 RLS 정책 수정

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "attendance_records_select_own" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_modify_staff_only" ON public.attendance_records;
DROP POLICY IF EXISTS "monthly_attendance_stats_select_own" ON public.monthly_attendance_stats;
DROP POLICY IF EXISTS "monthly_attendance_stats_modify_staff_only" ON public.monthly_attendance_stats;

-- 2. 더 관대한 정책 설정
-- attendance_records: 모든 인증된 사용자가 조회 가능, staff만 수정 가능
CREATE POLICY "attendance_records_select_all" ON public.attendance_records
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "attendance_records_modify_staff_only" ON public.attendance_records
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- monthly_attendance_stats: 모든 인증된 사용자가 조회 가능, staff만 수정 가능
CREATE POLICY "monthly_attendance_stats_select_all" ON public.monthly_attendance_stats
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "monthly_attendance_stats_modify_staff_only" ON public.monthly_attendance_stats
  FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- 3. 테이블 코멘트 업데이트
COMMENT ON TABLE public.attendance_records IS '직원 출퇴근 기록 - RLS 정책 수정됨';
COMMENT ON TABLE public.monthly_attendance_stats IS '직원 월별 출퇴근 통계 - RLS 정책 수정됨';
