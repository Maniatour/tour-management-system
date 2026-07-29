-- YTD 요일 평균선: 등록 → 순예약(등록−취소) 기준

BEGIN;

CREATE OR REPLACE FUNCTION public.reservation_status_transition_into_cancelled_like(
  p_from text,
  p_to text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    coalesce(lower(btrim(p_to)), '') IN ('cancelled', 'canceled', 'deleted', 'no_show')
    AND coalesce(lower(btrim(p_from)), '') NOT IN ('cancelled', 'canceled', 'deleted', 'no_show');
$$;

CREATE OR REPLACE FUNCTION public.reservation_is_rebooking_cancellation(p_reservation_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.reservation_follow_ups f
    WHERE f.reservation_id = p_reservation_id
      AND f.type = 'cancellation_reason'
      AND lower(btrim(coalesce(f.content, ''))) IN ('재예약', 'rebooking')
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_reg_cancel_ytd_weekday_avg(
  p_operator_id uuid DEFAULT NULL,
  p_customer_id text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_channel_id text DEFAULT NULL,
  p_tour_date_start date DEFAULT NULL,
  p_tour_date_end date DEFAULT NULL,
  p_year int DEFAULT NULL,
  p_through_ymd date DEFAULT NULL,
  p_tz text DEFAULT 'America/Los_Angeles',
  p_search_term text DEFAULT NULL
)
RETURNS TABLE (
  weekday_index int,
  avg_net_people numeric,
  avg_net_count numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_use_rollup boolean;
  v_tz text;
  v_start date;
  v_through date;
BEGIN
  IF NOT (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  ) THEN
    RETURN;
  END IF;

  v_tz := coalesce(nullif(btrim(p_tz), ''), 'America/Los_Angeles');
  v_start := make_date(p_year, 1, 1);
  v_through := p_through_ymd;

  v_use_rollup :=
    p_operator_id IS NOT NULL
    AND (p_customer_id IS NULL OR btrim(p_customer_id) = '')
    AND coalesce(btrim(p_status), 'all') = 'all'
    AND (
      p_channel_id IS NULL
      OR btrim(p_channel_id) = ''
      OR btrim(p_channel_id) = 'all'
    )
    AND p_tour_date_start IS NULL
    AND p_tour_date_end IS NULL
    AND nullif(btrim(coalesce(p_search_term, '')), '') IS NULL
    AND p_year IS NOT NULL
    AND v_through IS NOT NULL;

  IF v_use_rollup THEN
    RETURN QUERY
    WITH cancel_daily AS (
      SELECT
        (e.occurred_at AT TIME ZONE v_tz)::date AS local_date,
        count(*)::bigint AS cancelled_count,
        sum(
          public.reservation_rollup_party_size(r.adults, r.child, r.infant, r.total_people)
        )::bigint AS cancelled_people
      FROM public.reservation_status_events e
      INNER JOIN public.reservations r ON r.id = e.reservation_id
      WHERE r.operator_id = p_operator_id
        AND public.reservation_status_transition_into_cancelled_like(e.from_status, e.to_status)
        AND NOT public.reservation_is_rebooking_cancellation(e.reservation_id)
        AND (e.occurred_at AT TIME ZONE v_tz)::date >= v_start
        AND (e.occurred_at AT TIME ZONE v_tz)::date <= v_through
        AND extract(year FROM (e.occurred_at AT TIME ZONE v_tz))::int = p_year
      GROUP BY 1
    ),
    days AS (
      SELECT gs::date AS local_date
      FROM generate_series(v_start, v_through, interval '1 day') AS gs
    ),
    net_daily AS (
      SELECT
        d.local_date,
        coalesce(reg.registered_people, 0) - coalesce(c.cancelled_people, 0) AS net_people,
        coalesce(reg.registered_count, 0) - coalesce(c.cancelled_count, 0) AS net_count
      FROM days d
      LEFT JOIN public.reservation_reg_cancel_daily_rollup reg
        ON reg.operator_id = p_operator_id
        AND reg.local_date = d.local_date
      LEFT JOIN cancel_daily c
        ON c.local_date = d.local_date
    )
    SELECT
      extract(dow FROM nd.local_date)::int,
      avg(nd.net_people),
      avg(nd.net_count)
    FROM net_daily nd
    GROUP BY 1
    ORDER BY 1;

    RETURN;
  END IF;

  RETURN QUERY
  WITH params AS (
    SELECT
      v_tz AS tz,
      p_year AS yr,
      v_through AS through_ymd,
      v_start AS start_ymd,
      nullif(btrim(coalesce(p_search_term, '')), '') AS search_raw
  ),
  filtered AS (
    SELECT
      r.id,
      r.created_at,
      public.reservation_rollup_party_size(r.adults, r.child, r.infant, r.total_people)::numeric AS party_size
    FROM params p
    INNER JOIN public.reservations r ON true
    WHERE (p_operator_id IS NULL OR r.operator_id = p_operator_id)
      AND (p_customer_id IS NULL OR btrim(p_customer_id) = '' OR r.customer_id = p_customer_id)
      AND (
        NOT public.rls_is_staff_session_ok()
        OR public.staff_can_select_operator_row(r.operator_id)
      )
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
        (SELECT search_raw FROM params) IS NULL
        OR (
          (SELECT search_raw FROM params) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND (
            r.id::text = (SELECT search_raw FROM params)
            OR r.customer_id = (SELECT search_raw FROM params)
            OR r.product_id = (SELECT search_raw FROM params)
            OR r.channel_id = (SELECT search_raw FROM params)
          )
        )
        OR r.channel_rn ILIKE ('%' || (SELECT search_raw FROM params) || '%')
        OR coalesce(r.pickup_hotel, '') ILIKE ('%' || (SELECT search_raw FROM params) || '%')
        OR coalesce(r.added_by, '') ILIKE ('%' || (SELECT search_raw FROM params) || '%')
        OR coalesce(r.event_note, '') ILIKE ('%' || (SELECT search_raw FROM params) || '%')
        OR coalesce(r.sub_channel, '') ILIKE ('%' || (SELECT search_raw FROM params) || '%')
        OR coalesce(r.variant_key, '') ILIKE ('%' || (SELECT search_raw FROM params) || '%')
      )
  ),
  reg_daily AS (
    SELECT
      (f.created_at AT TIME ZONE (SELECT tz FROM params))::date AS local_d,
      sum(f.party_size) AS registered_people,
      count(*)::numeric AS registered_count
    FROM filtered f
    CROSS JOIN params p
    WHERE p.yr IS NOT NULL
      AND p.through_ymd IS NOT NULL
      AND (f.created_at AT TIME ZONE p.tz)::date >= p.start_ymd
      AND (f.created_at AT TIME ZONE p.tz)::date <= p.through_ymd
      AND extract(year FROM (f.created_at AT TIME ZONE p.tz))::int = p.yr
    GROUP BY 1
  ),
  cancel_daily AS (
    SELECT
      (e.occurred_at AT TIME ZONE (SELECT tz FROM params))::date AS local_d,
      count(*)::numeric AS cancelled_count,
      sum(f.party_size) AS cancelled_people
    FROM filtered f
    INNER JOIN public.reservation_status_events e ON e.reservation_id = f.id
    CROSS JOIN params p
    WHERE public.reservation_status_transition_into_cancelled_like(e.from_status, e.to_status)
      AND NOT public.reservation_is_rebooking_cancellation(f.id)
      AND p.yr IS NOT NULL
      AND p.through_ymd IS NOT NULL
      AND (e.occurred_at AT TIME ZONE p.tz)::date >= p.start_ymd
      AND (e.occurred_at AT TIME ZONE p.tz)::date <= p.through_ymd
      AND extract(year FROM (e.occurred_at AT TIME ZONE p.tz))::int = p.yr
    GROUP BY 1
  ),
  days AS (
    SELECT gs::date AS local_d
    FROM params p
    CROSS JOIN generate_series(p.start_ymd, p.through_ymd, interval '1 day') AS gs
    WHERE p.yr IS NOT NULL
      AND p.through_ymd IS NOT NULL
  ),
  net_daily AS (
    SELECT
      d.local_d,
      coalesce(rg.registered_people, 0) - coalesce(c.cancelled_people, 0) AS net_people,
      coalesce(rg.registered_count, 0) - coalesce(c.cancelled_count, 0) AS net_count
    FROM days d
    LEFT JOIN reg_daily rg ON rg.local_d = d.local_d
    LEFT JOIN cancel_daily c ON c.local_d = d.local_d
  )
  SELECT
    extract(dow FROM nd.local_d)::int,
    avg(nd.net_people),
    avg(nd.net_count)
  FROM net_daily nd
  GROUP BY 1
  ORDER BY 1;
END;
$$;

COMMENT ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) IS
  '예약 관리 7일 차트: 올해 1/1~p_through_ymd 일별 순예약(등록−취소) → 요일별 일평균. fast path는 롤업+status_events.';

GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO service_role;

COMMIT;
