-- customers ILIKE 검색: RLS customer_row_visible_for_policy 가 행마다
-- reservations↔tours EXISTS 를 평가하면서 statement timeout(500) 발생.
-- staff/team 은 별도 SELECT 정책으로 operator_id·세션만 검사 (tours 스캔 생략).

BEGIN;

CREATE OR REPLACE FUNCTION public.customer_row_visible_for_policy(p_customer_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Staff: 단일 customers lookup + tenant lock (reservations/tours 스캔 생략)
  IF public.rls_is_staff_session_ok() THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND public.staff_can_select_operator_row(c.operator_id)
    );
  END IF;

  -- Team (non-staff): id 존재만 확인
  IF public.rls_team_member_session_ok() THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
    );
  END IF;

  -- Guest / guide: 기존 가시성 규칙
  RETURN EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND (
        (
          length(trim(coalesce(c.email, ''))) > 0
          AND (
            (
              length(public.current_email()) > 0
              AND lower(trim(c.email)) = public.current_email()
            )
            OR (
              length(public.session_email_from_auth_users()) > 0
              AND lower(trim(c.email)) = public.session_email_from_auth_users()
            )
          )
        )
        OR EXISTS (
          SELECT 1
          FROM public.reservations r
          INNER JOIN public.tours t ON t.id = r.tour_id
          WHERE r.customer_id = c.id
            AND (
              public.current_email() = ANY (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
              OR public.current_email() = ANY (public.normalize_email_list(coalesce(t.assistant_id, '')))
              OR public.session_email_from_auth_users() = ANY (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
              OR public.session_email_from_auth_users() = ANY (public.normalize_email_list(coalesce(t.assistant_id, '')))
            )
        )
      )
  );
END;
$$;

COMMENT ON FUNCTION public.customer_row_visible_for_policy(text) IS
  'customers RLS (guest/guide): staff/team 은 별도 SELECT 정책 사용. DEFINER, row_security off.';

-- Staff / team: 행의 operator_id·세션만 검사 — ILIKE 스캔 시 tours 조인 없음
DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;
DROP POLICY IF EXISTS "customers_select_staff_fast" ON public.customers;
DROP POLICY IF EXISTS "customers_select_team_fast" ON public.customers;
DROP POLICY IF EXISTS "customers_select_guest_guide" ON public.customers;

CREATE POLICY "customers_select_staff_fast"
  ON public.customers FOR SELECT TO authenticated
  USING (
    public.rls_is_staff_session_ok()
    AND public.staff_can_select_operator_row(operator_id)
  );

CREATE POLICY "customers_select_team_fast"
  ON public.customers FOR SELECT TO authenticated
  USING (public.rls_team_member_session_ok());

CREATE POLICY "customers_select_guest_guide"
  ON public.customers FOR SELECT TO authenticated
  USING (
    NOT public.rls_is_staff_session_ok()
    AND NOT public.rls_team_member_session_ok()
    AND public.customer_row_visible_for_policy(id)
  );

CREATE INDEX IF NOT EXISTS idx_customers_operator_lower_name
  ON public.customers (operator_id, lower(name));

COMMIT;
