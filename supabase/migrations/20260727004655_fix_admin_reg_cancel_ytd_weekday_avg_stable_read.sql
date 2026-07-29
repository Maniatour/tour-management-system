-- STABLE RPC는 PostgREST READ ONLY 트랜잭션에서 실행된다.
-- refresh_* (DELETE/INSERT)를 호출하면 25006 → HTTP 405가 발생한다.
-- fast path는 일별 롤업만 읽어 YTD 요일 평균을 계산한다.

BEGIN;

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
  avg_registered_people numeric,
  avg_registered_count numeric
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
    WITH daily AS (
      SELECT
        extract(dow FROM d.local_date)::int AS wd,
        d.registered_people::numeric AS reg_people,
        d.registered_count::numeric AS reg_count
      FROM public.reservation_reg_cancel_daily_rollup d
      WHERE d.operator_id = p_operator_id
        AND d.local_date >= v_start
        AND d.local_date <= v_through
        AND extract(year FROM d.local_date)::int = p_year
        AND (d.registered_count > 0 OR d.registered_people > 0)
    ),
    rolled AS (
      SELECT
        wd,
        sum(reg_people) AS sum_people,
        sum(reg_count) AS sum_count,
        count(*)::numeric AS active_days
      FROM daily
      GROUP BY wd
    )
    SELECT
      r.wd::int,
      CASE WHEN r.active_days > 0 THEN r.sum_people / r.active_days ELSE 0 END,
      CASE WHEN r.active_days > 0 THEN r.sum_count / r.active_days ELSE 0 END
    FROM rolled r
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
  daily AS (
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
  )
  SELECT
    extract(dow FROM d.local_d)::int,
    avg(d.registered_people),
    avg(d.registered_count)
  FROM daily d
  GROUP BY 1
  ORDER BY 1;
END;
$$;

COMMENT ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) IS
  '예약 관리 7일 차트: 올해 1/1~p_through_ymd 등록 일별 합 → 요일별 일평균. fast path는 일별 롤업만 읽음(STABLE/READ ONLY).';

GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO service_role;

COMMIT;
