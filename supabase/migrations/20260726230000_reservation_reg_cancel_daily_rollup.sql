-- 일별 등록 롤업 + 월별 요일 스냅샷 — YTD 평균선·7일 차트 등록 집계 가속(필터 없을 때)

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 일별 롤업 (operator × 로컬 날짜)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_reg_cancel_daily_rollup (
  operator_id uuid NOT NULL REFERENCES public.operators (id) ON DELETE CASCADE,
  local_date date NOT NULL,
  registered_count bigint NOT NULL DEFAULT 0,
  registered_people bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operator_id, local_date),
  CONSTRAINT reservation_reg_cancel_daily_rollup_nonneg CHECK (
    registered_count >= 0 AND registered_people >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_reservation_reg_cancel_daily_rollup_op_date
  ON public.reservation_reg_cancel_daily_rollup (operator_id, local_date);

COMMENT ON TABLE public.reservation_reg_cancel_daily_rollup IS
  '예약 등록 일별 롤업(operator TZ). YTD 요일 평균·7일 차트 등록 집계용. 필터 없는 fast path.';

-- ---------------------------------------------------------------------------
-- 2. 월별 요일 스냅샷 (마감 월 — 일별 롤업에서 집계)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservation_reg_cancel_weekday_month_rollup (
  operator_id uuid NOT NULL REFERENCES public.operators (id) ON DELETE CASCADE,
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  weekday_index int NOT NULL CHECK (weekday_index >= 0 AND weekday_index <= 6),
  sum_registered_people bigint NOT NULL DEFAULT 0,
  sum_registered_count bigint NOT NULL DEFAULT 0,
  active_days int NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (operator_id, year, month, weekday_index)
);

COMMENT ON TABLE public.reservation_reg_cancel_weekday_month_rollup IS
  '마감 월 요일별 등록 합·활동일 수. YTD 평균 = sum(sum_people)/sum(active_days).';

-- ---------------------------------------------------------------------------
-- 3. 헬퍼
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reservation_rollup_party_size(
  p_adults int,
  p_child int,
  p_infant int,
  p_total_people int
)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_adults, 0) + coalesce(p_child, 0) + coalesce(p_infant, 0) > 0
      THEN coalesce(p_adults, 0) + coalesce(p_child, 0) + coalesce(p_infant, 0)
    ELSE coalesce(nullif(p_total_people, 0), 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.reservation_rollup_operator_tz(p_operator_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (SELECT o.timezone FROM public.operators o WHERE o.id = p_operator_id),
    'America/Los_Angeles'
  );
$$;

CREATE OR REPLACE FUNCTION public.reservation_rollup_apply_registration_delta(
  p_operator_id uuid,
  p_local_date date,
  p_count_delta int,
  p_people_delta int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_operator_id IS NULL OR p_local_date IS NULL THEN
    RETURN;
  END IF;
  IF p_count_delta = 0 AND p_people_delta = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.reservation_reg_cancel_daily_rollup (
    operator_id,
    local_date,
    registered_count,
    registered_people,
    updated_at
  )
  VALUES (
    p_operator_id,
    p_local_date,
    greatest(p_count_delta, 0),
    greatest(p_people_delta, 0),
    now()
  )
  ON CONFLICT (operator_id, local_date) DO UPDATE
  SET
    registered_count = greatest(0, public.reservation_reg_cancel_daily_rollup.registered_count + p_count_delta),
    registered_people = greatest(0, public.reservation_reg_cancel_daily_rollup.registered_people + p_people_delta),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.reservation_rollup_on_reservation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_tz text;
  v_local_d date;
  v_party int;
BEGIN
  IF lower(btrim(coalesce(NEW.status, ''))) = 'deleted' THEN
    RETURN NEW;
  END IF;
  IF NEW.operator_id IS NULL OR NEW.created_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_tz := public.reservation_rollup_operator_tz(NEW.operator_id);
  v_local_d := (NEW.created_at AT TIME ZONE v_tz)::date;
  v_party := public.reservation_rollup_party_size(NEW.adults, NEW.child, NEW.infant, NEW.total_people);

  PERFORM public.reservation_rollup_apply_registration_delta(NEW.operator_id, v_local_d, 1, v_party);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_reg_cancel_daily_rollup_insert ON public.reservations;
CREATE TRIGGER trg_reservation_reg_cancel_daily_rollup_insert
  AFTER INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.reservation_rollup_on_reservation_insert();

-- ---------------------------------------------------------------------------
-- 4. 월별 요일 스냅샷 갱신 (idempotent)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_reservation_reg_cancel_weekday_month_rollup(
  p_operator_id uuid,
  p_year int,
  p_month int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_start date;
  v_end date;
BEGIN
  IF p_operator_id IS NULL OR p_year IS NULL OR p_month IS NULL THEN
    RETURN;
  END IF;

  v_start := make_date(p_year, p_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  DELETE FROM public.reservation_reg_cancel_weekday_month_rollup
  WHERE operator_id = p_operator_id
    AND year = p_year
    AND month = p_month;

  INSERT INTO public.reservation_reg_cancel_weekday_month_rollup (
    operator_id,
    year,
    month,
    weekday_index,
    sum_registered_people,
    sum_registered_count,
    active_days,
    refreshed_at
  )
  SELECT
    d.operator_id,
    p_year,
    p_month,
    extract(dow FROM d.local_date)::int AS weekday_index,
    sum(d.registered_people)::bigint,
    sum(d.registered_count)::bigint,
    count(*)::int AS active_days,
    now()
  FROM public.reservation_reg_cancel_daily_rollup d
  WHERE d.operator_id = p_operator_id
    AND d.local_date >= v_start
    AND d.local_date <= v_end
    AND (d.registered_count > 0 OR d.registered_people > 0)
  GROUP BY d.operator_id, extract(dow FROM d.local_date)::int;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_reservation_reg_cancel_weekday_month_rollup_through(
  p_operator_id uuid,
  p_through_year int DEFAULT NULL,
  p_through_month int DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_tz text;
  v_now date;
  v_cur_y int;
  v_cur_m int;
  rec record;
BEGIN
  IF p_operator_id IS NULL THEN
    RETURN;
  END IF;

  v_tz := public.reservation_rollup_operator_tz(p_operator_id);
  v_now := (now() AT TIME ZONE v_tz)::date;
  v_cur_y := extract(year FROM v_now)::int;
  v_cur_m := extract(month FROM v_now)::int;

  FOR rec IN
    SELECT DISTINCT
      extract(year FROM d.local_date)::int AS y,
      extract(month FROM d.local_date)::int AS m
    FROM public.reservation_reg_cancel_daily_rollup d
    WHERE d.operator_id = p_operator_id
      AND (
        extract(year FROM d.local_date)::int < v_cur_y
        OR (
          extract(year FROM d.local_date)::int = v_cur_y
          AND extract(month FROM d.local_date)::int < v_cur_m
        )
      )
  LOOP
    PERFORM public.refresh_reservation_reg_cancel_weekday_month_rollup(p_operator_id, rec.y, rec.m);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. 초기 백필 (일별)
-- ---------------------------------------------------------------------------
INSERT INTO public.reservation_reg_cancel_daily_rollup (
  operator_id,
  local_date,
  registered_count,
  registered_people,
  updated_at
)
SELECT
  r.operator_id,
  (r.created_at AT TIME ZONE coalesce(o.timezone, 'America/Los_Angeles'))::date AS local_date,
  count(*)::bigint,
  sum(public.reservation_rollup_party_size(r.adults, r.child, r.infant, r.total_people))::bigint,
  now()
FROM public.reservations r
LEFT JOIN public.operators o ON o.id = r.operator_id
WHERE r.operator_id IS NOT NULL
  AND r.created_at IS NOT NULL
  AND lower(btrim(coalesce(r.status, ''))) <> 'deleted'
GROUP BY r.operator_id, (r.created_at AT TIME ZONE coalesce(o.timezone, 'America/Los_Angeles'))::date
ON CONFLICT (operator_id, local_date) DO UPDATE
SET
  registered_count = EXCLUDED.registered_count,
  registered_people = EXCLUDED.registered_people,
  updated_at = now();

-- 마감 월 스냅샷 (현재 월 제외)
DO $$
DECLARE
  rec record;
  v_now date;
  v_cur_y int;
  v_cur_m int;
BEGIN
  FOR rec IN SELECT DISTINCT operator_id FROM public.reservation_reg_cancel_daily_rollup
  LOOP
    v_now := (now() AT TIME ZONE public.reservation_rollup_operator_tz(rec.operator_id))::date;
    v_cur_y := extract(year FROM v_now)::int;
    v_cur_m := extract(month FROM v_now)::int;
    PERFORM public.refresh_reservation_reg_cancel_weekday_month_rollup_through(
      rec.operator_id,
      v_cur_y,
      v_cur_m
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. YTD 요일 평균 RPC — 롤업 fast path + 기존 스캔 fallback
-- ---------------------------------------------------------------------------
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
  v_cur_y int;
  v_cur_m int;
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
  v_cur_y := extract(year FROM (now() AT TIME ZONE v_tz))::int;
  v_cur_m := extract(month FROM (now() AT TIME ZONE v_tz))::int;

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
    PERFORM public.refresh_reservation_reg_cancel_weekday_month_rollup_through(
      p_operator_id,
      v_cur_y,
      v_cur_m
    );

    RETURN QUERY
    WITH month_part AS (
      SELECT
        m.weekday_index AS wd,
        sum(m.sum_registered_people)::numeric AS sum_people,
        sum(m.sum_registered_count)::numeric AS sum_count,
        sum(m.active_days)::numeric AS active_days
      FROM public.reservation_reg_cancel_weekday_month_rollup m
      WHERE m.operator_id = p_operator_id
        AND m.year = p_year
        AND make_date(m.year, m.month, 1) < make_date(v_cur_y, v_cur_m, 1)
        AND make_date(m.year, m.month, 1) + interval '1 month' - interval '1 day' <= v_through
      GROUP BY m.weekday_index
    ),
    cur_month_daily AS (
      SELECT
        extract(dow FROM d.local_date)::int AS wd,
        d.registered_people::numeric AS reg_people,
        d.registered_count::numeric AS reg_count
      FROM public.reservation_reg_cancel_daily_rollup d
      WHERE p_year = v_cur_y
        AND d.operator_id = p_operator_id
        AND extract(year FROM d.local_date)::int = p_year
        AND extract(month FROM d.local_date)::int = v_cur_m
        AND d.local_date >= v_start
        AND d.local_date <= v_through
        AND (d.registered_count > 0 OR d.registered_people > 0)
    ),
    cur_month_part AS (
      SELECT
        wd,
        sum(reg_people) AS sum_people,
        sum(reg_count) AS sum_count,
        count(*)::numeric AS active_days
      FROM cur_month_daily
      WHERE p_year = v_cur_y
      GROUP BY wd
    ),
    combined AS (
      SELECT wd, sum_people, sum_count, active_days FROM month_part
      UNION ALL
      SELECT wd, sum_people, sum_count, active_days FROM cur_month_part
    ),
    rolled AS (
      SELECT
        c.wd,
        sum(c.sum_people) AS sum_people,
        sum(c.sum_count) AS sum_count,
        sum(c.active_days) AS active_days
      FROM combined c
      GROUP BY c.wd
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

-- ---------------------------------------------------------------------------
-- 7. 7일 차트 일별 등록 RPC (롤업)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reg_cancel_week_daily_registered(
  p_operator_id uuid,
  p_start_ymd date,
  p_end_ymd date
)
RETURNS TABLE (
  local_date date,
  registered_people bigint,
  registered_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    d.local_date,
    d.registered_people,
    d.registered_count
  FROM public.reservation_reg_cancel_daily_rollup d
  WHERE (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  )
    AND p_operator_id IS NOT NULL
    AND d.operator_id = p_operator_id
    AND d.local_date >= p_start_ymd
    AND d.local_date <= p_end_ymd
    AND (
      NOT public.rls_is_staff_session_ok()
      OR public.staff_can_select_operator_row(d.operator_id)
    )
  ORDER BY d.local_date;
$$;

COMMENT ON FUNCTION public.admin_reg_cancel_week_daily_registered(uuid, date, date) IS
  '7일 차트 등록 막대용 일별 합(롤업). 취소는 클라이언트 감사 유지.';

-- ---------------------------------------------------------------------------
-- 8. RLS (staff read)
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservation_reg_cancel_daily_rollup ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_reg_cancel_weekday_month_rollup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservation_reg_cancel_daily_rollup_select_staff ON public.reservation_reg_cancel_daily_rollup;
CREATE POLICY reservation_reg_cancel_daily_rollup_select_staff
  ON public.reservation_reg_cancel_daily_rollup
  FOR SELECT TO authenticated
  USING (
    public.rls_is_staff_session_ok()
    AND public.staff_can_select_operator_row(operator_id)
  );

DROP POLICY IF EXISTS reservation_reg_cancel_weekday_month_rollup_select_staff ON public.reservation_reg_cancel_weekday_month_rollup;
CREATE POLICY reservation_reg_cancel_weekday_month_rollup_select_staff
  ON public.reservation_reg_cancel_weekday_month_rollup
  FOR SELECT TO authenticated
  USING (
    public.rls_is_staff_session_ok()
    AND public.staff_can_select_operator_row(operator_id)
  );

GRANT SELECT ON public.reservation_reg_cancel_daily_rollup TO authenticated;
GRANT SELECT ON public.reservation_reg_cancel_weekday_month_rollup TO authenticated;

REVOKE ALL ON FUNCTION public.reservation_rollup_apply_registration_delta(uuid, date, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_reservation_reg_cancel_weekday_month_rollup(uuid, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_reservation_reg_cancel_weekday_month_rollup_through(uuid, int, int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_week_daily_registered(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reg_cancel_week_daily_registered(uuid, date, date) TO service_role;

COMMIT;
