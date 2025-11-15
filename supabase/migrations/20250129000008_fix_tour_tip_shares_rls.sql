-- tour_tip_shares 테이블의 RLS 정책 수정
-- INSERT 정책이 제대로 작동하도록 수정

-- 기존 정책 삭제
DROP POLICY IF EXISTS "admins_can_manage_tip_shares" ON tour_tip_shares;

-- 관리자는 팁 쉐어 정보를 생성할 수 있음
DROP POLICY IF EXISTS "admins_can_insert_tip_shares" ON tour_tip_shares;

-- is_staff 함수 사용 (다른 테이블과 동일한 패턴)
CREATE POLICY "admins_can_insert_tip_shares" ON tour_tip_shares
  FOR INSERT
  WITH CHECK (public.is_staff(public.current_email()));

-- 관리자는 팁 쉐어 정보를 수정할 수 있음
DROP POLICY IF EXISTS "admins_can_update_tip_shares" ON tour_tip_shares;
CREATE POLICY "admins_can_update_tip_shares" ON tour_tip_shares
  FOR UPDATE
  USING (public.is_staff(public.current_email()))
  WITH CHECK (public.is_staff(public.current_email()));

-- 관리자는 팁 쉐어 정보를 삭제할 수 있음
DROP POLICY IF EXISTS "admins_can_delete_tip_shares" ON tour_tip_shares;
CREATE POLICY "admins_can_delete_tip_shares" ON tour_tip_shares
  FOR DELETE
  USING (public.is_staff(public.current_email()));

