-- admin_operational_queue_candidate_ids: SECURITY INVOKER + RLS 행별 평가 → statement timeout(500)
-- DEFINER + row_security off + operator_id 스코프로 후보 id만 빠르게 반환

BEGIN;

DROP FUNCTION IF EXISTS public.admin_operational_queue_candidate_ids(text);

CREATE OR REPLACE FUNCTION public.admin_operational_queue_candidate_ids(
  p_customer_id text DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL
)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH bounds AS (
    SELECT
      CURRENT_DATE::date AS today,
      (CURRENT_DATE + 7)::date AS day7
  ),
  mania_products AS (
    SELECT id FROM public.products
    WHERE sub_category IN ('Mania Tour', 'Mania Service')
  )
  SELECT DISTINCT r.id
  FROM public.reservations r
  CROSS JOIN bounds b
  LEFT JOIN public.reservation_pricing rp ON rp.reservation_id = r.id
  LEFT JOIN mania_products mp ON mp.id = r.product_id
  WHERE lower(btrim(coalesce(r.status, ''))) <> 'deleted'
    AND (p_customer_id IS NULL OR r.customer_id = p_customer_id)
    AND (p_operator_id IS NULL OR r.operator_id = p_operator_id)
    AND (
      public.rls_is_staff_session_ok()
      OR public.is_team_member(public.current_email())
      OR public.is_team_member_for_session()
      OR public.is_team_member(public.session_email_from_auth_users())
    )
    AND (
      NOT public.rls_is_staff_session_ok()
      OR public.staff_can_select_operator_row(r.operator_id)
    )
    AND (
      (
        lower(btrim(coalesce(r.status, ''))) = 'pending'
        AND r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
        AND r.tour_date <= b.day7
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'pending'
        AND r.customer_id IS NULL
        AND r.product_id IS NULL
        AND (
          r.tour_id IS NULL
          OR btrim(r.tour_id::text) = ''
          OR lower(btrim(r.tour_id::text)) IN ('null', 'undefined')
        )
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'confirmed'
        AND mp.id IS NOT NULL
        AND (
          r.tour_id IS NULL
          OR btrim(r.tour_id::text) = ''
          OR lower(btrim(r.tour_id::text)) IN ('null', 'undefined')
        )
      )
      OR (
        r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
        AND lower(btrim(coalesce(r.status, ''))) NOT IN ('inquiry', 'cancelled', 'canceled')
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) IN ('cancelled', 'canceled')
        AND r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
      )
      OR (
        r.tour_date IS NOT NULL
        AND r.tour_date < b.today
        AND coalesce(rp.balance_amount, 0) > 0.01
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) NOT LIKE 'cancelled%'
        AND lower(btrim(coalesce(r.status, ''))) NOT IN ('canceled')
        AND (rp.reservation_id IS NULL OR coalesce(rp.total_price, 0) <= 0)
      )
      OR EXISTS (
        SELECT 1 FROM public.payment_records pr
        WHERE pr.reservation_id = r.id
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'confirmed'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_records pr
          WHERE pr.reservation_id = r.id
        )
      )
      OR (
        lower(btrim(coalesce(r.status, ''))) IN ('cancelled', 'canceled')
        AND (
          EXISTS (SELECT 1 FROM public.payment_records pr WHERE pr.reservation_id = r.id)
          OR coalesce(rp.total_price, 0) > 0.01
          OR coalesce(rp.balance_amount, 0) > 0.01
        )
      )
    );
$$;

COMMENT ON FUNCTION public.admin_operational_queue_candidate_ids(text, uuid) IS
  '예약 처리 필요·Follow-up 운영 큐 후보 예약 id (DEFINER, operator 스코프, RLS timeout 방지)';

GRANT EXECUTE ON FUNCTION public.admin_operational_queue_candidate_ids(text, uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_reservations_op_queue_operator_tour_date
  ON public.reservations (operator_id, tour_date)
  WHERE lower(btrim(coalesce(status, ''))) <> 'deleted';

COMMIT;
