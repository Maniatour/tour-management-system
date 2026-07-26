-- customers ILIKE + RLS: 함수형 정책이 (operator_id, lower(name)) 인덱스 푸시다운을 막아
-- operator 전체(1만+행) 힙 스캔 → statement timeout(500).
-- 1) staff/team 유사고객 검색은 SECURITY DEFINER RPC (row_security off)
-- 2) SELECT RLS는 CASE 단락 + operator_id 직접 비교 (staff_can_select_operator_row 생략)

BEGIN;

DROP POLICY IF EXISTS "customers_select_staff_fast" ON public.customers;
DROP POLICY IF EXISTS "customers_select_team_fast" ON public.customers;
DROP POLICY IF EXISTS "customers_select_guest_guide" ON public.customers;
DROP POLICY IF EXISTS "customers_select_authenticated" ON public.customers;

CREATE POLICY "customers_select_authenticated"
  ON public.customers FOR SELECT TO authenticated
  USING (
    CASE
      WHEN public.rls_is_staff_session_ok() THEN (
        public.saas_jwt_active_operator_id() IS NULL
        OR operator_id = public.current_operator_id()
      )
      WHEN public.rls_team_member_session_ok() THEN true
      ELSE public.customer_row_visible_for_policy(id)
    END
  );

CREATE OR REPLACE FUNCTION public.search_customers_for_similar_match(
  p_operator_id uuid,
  p_name text DEFAULT NULL,
  p_name_partial boolean DEFAULT false,
  p_email text DEFAULT NULL,
  p_phone_tail text DEFAULT NULL,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  id text,
  name text,
  email text,
  phone text,
  archive boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_phone_tail text := nullif(trim(coalesce(p_phone_tail, '')), '');
BEGIN
  IF NOT (
    public.rls_is_staff_session_ok()
    OR public.rls_team_member_session_ok()
  ) THEN
    RETURN;
  END IF;

  IF public.rls_is_staff_session_ok() THEN
    IF
      public.saas_jwt_active_operator_id() IS NOT NULL
      AND (
        p_operator_id IS NULL
        OR p_operator_id <> public.current_operator_id()
      )
    THEN
      RETURN;
    END IF;
  END IF;

  IF v_name IS NULL AND v_email IS NULL AND v_phone_tail IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id::text,
    c.name::text,
    c.email::text,
    c.phone::text,
    c.archive
  FROM public.customers c
  WHERE (p_operator_id IS NULL OR c.operator_id = p_operator_id)
    AND (
      (
        v_name IS NOT NULL
        AND (
          (
            NOT COALESCE(p_name_partial, false)
            AND lower(trim(c.name)) = lower(v_name)
          )
          OR (
            COALESCE(p_name_partial, false)
            AND c.name ILIKE ('%' || v_name || '%')
          )
        )
      )
      OR (
        v_email IS NOT NULL
        AND length(v_email) > 0
        AND lower(trim(coalesce(c.email, ''))) = lower(v_email)
      )
      OR (
        v_phone_tail IS NOT NULL
        AND length(v_phone_tail) >= 8
        AND c.phone ILIKE ('%' || v_phone_tail || '%')
      )
    )
  LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION public.search_customers_for_similar_match(uuid, text, boolean, text, text, integer) IS
  'staff/team 유사 고객 검색: RLS 우회 + operator/name 인덱스 사용 (DEFINER, row_security off).';

GRANT EXECUTE ON FUNCTION public.search_customers_for_similar_match(uuid, text, boolean, text, text, integer)
  TO authenticated;

COMMIT;
