-- card-week 활동 구간 행 수 — UNION id RPC와 동일 필터로 exact count (진행률 total)

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_reservation_card_week_activity_count(
  p_operator_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_status text DEFAULT 'all',
  p_channel_id text DEFAULT NULL,
  p_tour_date_start date DEFAULT NULL,
  p_tour_date_end date DEFAULT NULL,
  p_customer_id text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_allowed boolean;
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_count bigint := 0;
BEGIN
  SELECT (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  )
  INTO v_allowed;

  IF NOT coalesce(v_allowed, false) THEN
    RETURN 0;
  END IF;

  IF p_operator_id IS NULL
     OR p_range_start IS NULL
     OR p_range_end IS NULL THEN
    RETURN 0;
  END IF;

  IF public.rls_is_staff_session_ok()
     AND NOT public.staff_can_select_operator_row(p_operator_id) THEN
    RETURN 0;
  END IF;

  WITH created_branch AS (
    SELECT r.id
    FROM public.reservations r
    WHERE r.operator_id = p_operator_id
      AND r.created_at >= p_range_start
      AND r.created_at <= p_range_end
      AND (
        CASE
          WHEN v_status = 'all' THEN lower(btrim(coalesce(r.status, ''))) <> 'deleted'
          ELSE lower(btrim(coalesce(r.status, ''))) = v_status
        END
      )
      AND (p_channel_id IS NULL OR btrim(p_channel_id) = '' OR p_channel_id = 'all' OR r.channel_id = p_channel_id)
      AND (p_customer_id IS NULL OR btrim(p_customer_id) = '' OR r.customer_id = p_customer_id)
      AND (
        p_tour_date_start IS NULL
        OR p_tour_date_end IS NULL
        OR (r.tour_date IS NOT NULL AND r.tour_date >= p_tour_date_start AND r.tour_date <= p_tour_date_end)
      )
  ),
  updated_branch AS (
    SELECT r.id
    FROM public.reservations r
    WHERE r.operator_id = p_operator_id
      AND r.updated_at >= p_range_start
      AND r.updated_at <= p_range_end
      AND (
        r.created_at IS NULL
        OR r.created_at < p_range_start
        OR r.created_at > p_range_end
      )
      AND (
        CASE
          WHEN v_status = 'all' THEN lower(btrim(coalesce(r.status, ''))) <> 'deleted'
          ELSE lower(btrim(coalesce(r.status, ''))) = v_status
        END
      )
      AND (p_channel_id IS NULL OR btrim(p_channel_id) = '' OR p_channel_id = 'all' OR r.channel_id = p_channel_id)
      AND (p_customer_id IS NULL OR btrim(p_customer_id) = '' OR r.customer_id = p_customer_id)
      AND (
        p_tour_date_start IS NULL
        OR p_tour_date_end IS NULL
        OR (r.tour_date IS NOT NULL AND r.tour_date >= p_tour_date_start AND r.tour_date <= p_tour_date_end)
      )
  )
  SELECT count(*)::bigint
  INTO v_count
  FROM (
    SELECT id FROM created_branch
    UNION
    SELECT id FROM updated_branch
  ) u;

  RETURN coalesce(v_count, 0);
END;
$$;

COMMENT ON FUNCTION public.admin_reservation_card_week_activity_count(
  uuid, timestamptz, timestamptz, text, text, date, date, text
) IS
  '예약 관리 card-week: created_at/updated_at UNION 활동 구간 distinct 행 수 (진행률 total)';

GRANT EXECUTE ON FUNCTION public.admin_reservation_card_week_activity_count(
  uuid, timestamptz, timestamptz, text, text, date, date, text
) TO authenticated;

COMMIT;
