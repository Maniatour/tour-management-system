-- Fix tour_tip_shares / tour_tip_share_ops RLS 403 on save.
--
-- Symptoms: TipsShareModal insert().select() fails with 403 because:
--   1) INSERT used is_staff(current_email()) but RETURNING needs SELECT policies.
--   2) admins_can_view_all_tip_shares only allowed super/office manager/op — not manager.
--   3) tour_tip_share_ops still used legacy position + JWT email checks.
--
-- Align with rls_is_staff_session_ok() + session email fallback (20260621260000 pattern).
-- Keep Phase 6c.7 tenant HR SELECT policies unchanged.

BEGIN;

-- ---- tour_tip_shares: staff SELECT (RETURNING after INSERT) ----
DROP POLICY IF EXISTS "admins_can_view_all_tip_shares" ON public.tour_tip_shares;
CREATE POLICY "admins_can_view_all_tip_shares"
  ON public.tour_tip_shares
  FOR SELECT
  TO authenticated
  USING (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "team_members_can_view_own_tip_shares" ON public.tour_tip_shares;
CREATE POLICY "team_members_can_view_own_tip_shares"
  ON public.tour_tip_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team
      WHERE team.is_active = true
        AND (
          lower(team.email) = lower(coalesce(public.current_email(), ''))
          OR (
            length(public.session_email_from_auth_users()) > 0
            AND lower(team.email) = public.session_email_from_auth_users()
          )
          OR lower(team.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        AND (
          team.email = guide_email
          OR team.email = assistant_email
          OR team.email = op_email
        )
    )
  );

-- ---- tour_tip_shares: staff writes ----
DROP POLICY IF EXISTS "admins_can_insert_tip_shares" ON public.tour_tip_shares;
CREATE POLICY "admins_can_insert_tip_shares"
  ON public.tour_tip_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "admins_can_update_tip_shares" ON public.tour_tip_shares;
CREATE POLICY "admins_can_update_tip_shares"
  ON public.tour_tip_shares
  FOR UPDATE
  TO authenticated
  USING (public.rls_is_staff_session_ok())
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "admins_can_delete_tip_shares" ON public.tour_tip_shares;
CREATE POLICY "admins_can_delete_tip_shares"
  ON public.tour_tip_shares
  FOR DELETE
  TO authenticated
  USING (public.rls_is_staff_session_ok());

-- ---- tour_tip_share_ops: staff SELECT + writes ----
DROP POLICY IF EXISTS "admins_can_view_all_op_shares" ON public.tour_tip_share_ops;
CREATE POLICY "admins_can_view_all_op_shares"
  ON public.tour_tip_share_ops
  FOR SELECT
  TO authenticated
  USING (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "team_members_can_view_own_op_shares" ON public.tour_tip_share_ops;
CREATE POLICY "team_members_can_view_own_op_shares"
  ON public.tour_tip_share_ops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.team
      WHERE team.is_active = true
        AND (
          lower(team.email) = lower(coalesce(public.current_email(), ''))
          OR (
            length(public.session_email_from_auth_users()) > 0
            AND lower(team.email) = public.session_email_from_auth_users()
          )
          OR lower(team.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
        AND team.email = op_email
    )
  );

DROP POLICY IF EXISTS "admins_can_manage_op_shares" ON public.tour_tip_share_ops;

DROP POLICY IF EXISTS "admins_can_insert_op_shares" ON public.tour_tip_share_ops;
CREATE POLICY "admins_can_insert_op_shares"
  ON public.tour_tip_share_ops
  FOR INSERT
  TO authenticated
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "admins_can_update_op_shares" ON public.tour_tip_share_ops;
CREATE POLICY "admins_can_update_op_shares"
  ON public.tour_tip_share_ops
  FOR UPDATE
  TO authenticated
  USING (public.rls_is_staff_session_ok())
  WITH CHECK (public.rls_is_staff_session_ok());

DROP POLICY IF EXISTS "admins_can_delete_op_shares" ON public.tour_tip_share_ops;
CREATE POLICY "admins_can_delete_op_shares"
  ON public.tour_tip_share_ops
  FOR DELETE
  TO authenticated
  USING (public.rls_is_staff_session_ok());

COMMENT ON POLICY "admins_can_view_all_tip_shares"
  ON public.tour_tip_shares IS
  'Staff SELECT (incl. INSERT RETURNING). Replaces position allow-list that excluded manager.';

COMMENT ON POLICY "admins_can_insert_tip_shares"
  ON public.tour_tip_shares IS
  'Staff INSERT via rls_is_staff_session_ok() (session email fallback).';

COMMENT ON POLICY "admins_can_view_all_op_shares"
  ON public.tour_tip_share_ops IS
  'Staff SELECT for OP tip-share rows (session fallback).';

COMMIT;
