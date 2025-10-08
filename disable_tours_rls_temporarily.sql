-- 투어 테이블 RLS 정책 임시 비활성화 (디버깅용)
-- 상태 변경이 작동하지 않는 문제 해결을 위해

BEGIN;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "tours_select_all" ON public.tours;
DROP POLICY IF EXISTS "tours_modify_staff_only" ON public.tours;
DROP POLICY IF EXISTS "tours_insert_all" ON public.tours;
DROP POLICY IF EXISTS "tours_update_all" ON public.tours;
DROP POLICY IF EXISTS "tours_delete_all" ON public.tours;
DROP POLICY IF EXISTS "tours_select_assigned_or_staff" ON public.tours;

-- 모든 작업을 허용하는 정책 생성
CREATE POLICY "tours_all_operations" ON public.tours
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMIT;
