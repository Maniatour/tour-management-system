-- 7일 차트 YTD 요일별 등록 일평균 — 예약 전량 fetch 대신 서버 집계(7요일 × 2지표)

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  WITH auth_gate AS (
    SELECT (
      public.rls_is_staff_session_ok()
      OR public.is_team_member(public.current_email())
      OR public.is_team_member_for_session()
      OR public.is_team_member(public.session_email_from_auth_users())
    ) AS allowed
  ),
  params AS (
    SELECT
      coalesce(nullif(btrim(p_tz), ''), 'America/Los_Angeles') AS tz,
      p_year AS yr,
      p_through_ymd AS through_ymd,
      make_date(p_year, 1, 1) AS start_ymd,
      nullif(btrim(coalesce(p_search_term, '')), '') AS search_raw
  ),
  filtered AS (
    SELECT
      r.created_at,
      CASE
        WHEN coalesce(r.adults, 0) + coalesce(r.child, 0) + coalesce(r.infant, 0) > 0
          THEN coalesce(r.adults, 0) + coalesce(r.child, 0) + coalesce(r.infant, 0)
        ELSE coalesce(nullif(r.total_people, 0), 0)
      END::numeric AS party_size
    FROM auth_gate g
    CROSS JOIN params p
    INNER JOIN public.reservations r ON g.allowed
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
        p.search_raw IS NULL
        OR (
          p.search_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          AND (
            r.id::text = p.search_raw
            OR r.customer_id = p.search_raw
            OR r.product_id = p.search_raw
            OR r.channel_id = p.search_raw
          )
        )
        OR r.channel_rn ILIKE ('%' || p.search_raw || '%')
        OR coalesce(r.pickup_hotel, '') ILIKE ('%' || p.search_raw || '%')
        OR coalesce(r.added_by, '') ILIKE ('%' || p.search_raw || '%')
        OR coalesce(r.event_note, '') ILIKE ('%' || p.search_raw || '%')
        OR coalesce(r.sub_channel, '') ILIKE ('%' || p.search_raw || '%')
        OR coalesce(r.variant_key, '') ILIKE ('%' || p.search_raw || '%')
        OR (
          p.search_raw ~ '^\d{4}-\d{2}-\d{2}$'
          AND r.tour_date = p.search_raw::date
        )
        OR EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = r.customer_id
            AND (p_operator_id IS NULL OR c.operator_id = p_operator_id)
            AND (
              coalesce(c.name, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(c.special_requests, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(c.email, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(c.phone, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(c.emergency_contact, '') ILIKE ('%' || p.search_raw || '%')
            )
          LIMIT 1
        )
        OR EXISTS (
          SELECT 1
          FROM public.products pr
          WHERE pr.id = r.product_id
            AND (p_operator_id IS NULL OR pr.operator_id = p_operator_id)
            AND (
              coalesce(pr.name, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(pr.name_ko, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(pr.name_en, '') ILIKE ('%' || p.search_raw || '%')
              OR coalesce(pr.product_code, '') ILIKE ('%' || p.search_raw || '%')
            )
          LIMIT 1
        )
        OR EXISTS (
          SELECT 1
          FROM public.channels ch
          WHERE ch.id = r.channel_id
            AND (p_operator_id IS NULL OR ch.operator_id = p_operator_id)
            AND coalesce(ch.name, '') ILIKE ('%' || p.search_raw || '%')
          LIMIT 1
        )
      )
  ),
  daily AS (
    SELECT
      (f.created_at AT TIME ZONE p.tz)::date AS local_d,
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
    extract(dow FROM d.local_d)::int AS weekday_index,
    avg(d.registered_people) AS avg_registered_people,
    avg(d.registered_count) AS avg_registered_count
  FROM daily d
  GROUP BY 1
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) IS
  '예약 관리 7일 차트: 올해 1/1~p_through_ymd 등록 일별 합 → 요일별 일평균(인원·건수). 브라우저 로컬 TZ는 p_tz로 전달.';

REVOKE ALL ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_ytd_weekday_avg(uuid, text, text, text, date, date, int, date, text, text) TO service_role;

COMMIT;
