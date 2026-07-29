-- 7일 차트 일별 등록 RPC: 필터 없을 때 롤업, 있을 때 인덱스 스캔

BEGIN;

DROP FUNCTION IF EXISTS public.admin_reg_cancel_week_daily_registered(uuid, date, date);

CREATE OR REPLACE FUNCTION public.admin_reg_cancel_week_daily_registered(
  p_operator_id uuid,
  p_start_ymd date,
  p_end_ymd date,
  p_customer_id text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_channel_id text DEFAULT NULL,
  p_tour_date_start date DEFAULT NULL,
  p_tour_date_end date DEFAULT NULL,
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  local_date date,
  registered_people bigint,
  registered_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_tz text;
  v_use_rollup boolean;
  v_search text;
BEGIN
  IF NOT (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  ) THEN
    RETURN;
  END IF;

  IF p_operator_id IS NULL OR p_start_ymd IS NULL OR p_end_ymd IS NULL THEN
    RETURN;
  END IF;

  v_search := nullif(btrim(coalesce(p_search_term, '')), '');
  v_use_rollup :=
    (p_customer_id IS NULL OR btrim(p_customer_id) = '')
    AND coalesce(btrim(p_status), 'all') = 'all'
    AND (
      p_channel_id IS NULL
      OR btrim(p_channel_id) = ''
      OR btrim(p_channel_id) = 'all'
    )
    AND p_tour_date_start IS NULL
    AND p_tour_date_end IS NULL
    AND v_search IS NULL;

  IF v_use_rollup THEN
    RETURN QUERY
    SELECT
      d.local_date,
      d.registered_people,
      d.registered_count
    FROM public.reservation_reg_cancel_daily_rollup d
    WHERE d.operator_id = p_operator_id
      AND d.local_date >= p_start_ymd
      AND d.local_date <= p_end_ymd
      AND (
        NOT public.rls_is_staff_session_ok()
        OR public.staff_can_select_operator_row(d.operator_id)
      )
    ORDER BY d.local_date;
    RETURN;
  END IF;

  v_tz := public.reservation_rollup_operator_tz(p_operator_id);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      (r.created_at AT TIME ZONE v_tz)::date AS local_d,
      public.reservation_rollup_party_size(r.adults, r.child, r.infant, r.total_people)::bigint AS party_size
    FROM public.reservations r
    WHERE r.operator_id = p_operator_id
      AND r.created_at IS NOT NULL
      AND (r.created_at AT TIME ZONE v_tz)::date >= p_start_ymd
      AND (r.created_at AT TIME ZONE v_tz)::date <= p_end_ymd
      AND (
        NOT public.rls_is_staff_session_ok()
        OR public.staff_can_select_operator_row(r.operator_id)
      )
      AND (p_customer_id IS NULL OR btrim(p_customer_id) = '' OR r.customer_id = p_customer_id)
      AND (
        coalesce(btrim(p_status), 'all') = 'all'
        OR lower(btrim(coalesce(r.status, ''))) = lower(btrim(p_status))
      )
      AND (
        coalesce(btrim(p_status), 'all') <> 'all'
        OR lower(btrim(coalesce(r.status, ''))) <> 'deleted'
      )
      AND (
        p_channel_id IS NULL
        OR btrim(p_channel_id) = ''
        OR btrim(p_channel_id) = 'all'
        OR r.channel_id = p_channel_id
      )
      AND (
        p_tour_date_start IS NULL
        OR p_tour_date_end IS NULL
        OR (
          r.tour_date IS NOT NULL
          AND r.tour_date >= p_tour_date_start
          AND r.tour_date <= p_tour_date_end
        )
      )
      AND (
        v_search IS NULL
        OR (
          v_search ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND (
            r.id::text = v_search
            OR r.customer_id = v_search
            OR r.product_id = v_search
            OR r.channel_id = v_search
          )
        )
        OR r.channel_rn ILIKE ('%' || v_search || '%')
        OR coalesce(r.pickup_hotel, '') ILIKE ('%' || v_search || '%')
        OR coalesce(r.added_by, '') ILIKE ('%' || v_search || '%')
        OR coalesce(r.event_note, '') ILIKE ('%' || v_search || '%')
        OR coalesce(r.sub_channel, '') ILIKE ('%' || v_search || '%')
        OR coalesce(r.variant_key, '') ILIKE ('%' || v_search || '%')
      )
  )
  SELECT
    f.local_d,
    coalesce(sum(f.party_size), 0)::bigint,
    count(*)::bigint
  FROM filtered f
  GROUP BY f.local_d
  ORDER BY f.local_d;
END;
$$;

COMMENT ON FUNCTION public.admin_reg_cancel_week_daily_registered(
  uuid, date, date, text, text, text, date, date, text
) IS
  '7일 차트 등록 막대용 일별 합. 필터 없으면 롤업, 있으면 reservations 스캔(인덱스).';

GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_week_daily_registered(
  uuid, date, date, text, text, text, date, date, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_week_daily_registered(
  uuid, date, date, text, text, text, date, date, text
) TO service_role;

COMMIT;
