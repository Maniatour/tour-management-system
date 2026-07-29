-- 예약 관리 검색 보조 lookup 1회 RPC + 목록/필터용 복합 인덱스
-- 기존: customers/products/channels 각각 PostgREST 왕복(최대 4회)
-- 변경: admin_reservation_search_lookup_ids 1회 → customer/product/channel id 배열

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. 검색 보조 ID lookup RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reservation_search_lookup_ids(
  p_operator_id uuid,
  p_term text,
  p_limit int DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_term text := btrim(coalesce(p_term, ''));
  v_like text;
  v_limit int := greatest(1, least(coalesce(p_limit, 500), 500));
  v_allowed boolean;
  v_customer_ids text[] := ARRAY[]::text[];
  v_product_ids text[] := ARRAY[]::text[];
  v_channel_ids text[] := ARRAY[]::text[];
BEGIN
  SELECT (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  )
  INTO v_allowed;

  IF NOT coalesce(v_allowed, false) THEN
    RETURN jsonb_build_object(
      'customer_ids', '[]'::jsonb,
      'product_ids', '[]'::jsonb,
      'channel_ids', '[]'::jsonb
    );
  END IF;

  IF p_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'customer_ids', '[]'::jsonb,
      'product_ids', '[]'::jsonb,
      'channel_ids', '[]'::jsonb
    );
  END IF;

  IF public.rls_is_staff_session_ok()
     AND NOT public.staff_can_select_operator_row(p_operator_id) THEN
    RETURN jsonb_build_object(
      'customer_ids', '[]'::jsonb,
      'product_ids', '[]'::jsonb,
      'channel_ids', '[]'::jsonb
    );
  END IF;

  -- ASCII 1글자·빈 문자열: 클라이언트와 동일하게 보조 lookup 생략
  IF v_term = '' OR (char_length(v_term) = 1 AND v_term ~ '^[\x00-\x7F]$') THEN
    RETURN jsonb_build_object(
      'customer_ids', '[]'::jsonb,
      'product_ids', '[]'::jsonb,
      'channel_ids', '[]'::jsonb
    );
  END IF;

  v_like := '%' || replace(replace(replace(v_term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';

  SELECT coalesce(array_agg(x.id), ARRAY[]::text[])
  INTO v_customer_ids
  FROM (
    SELECT c.id::text AS id
    FROM public.customers c
    WHERE c.operator_id = p_operator_id
      AND coalesce(c.archive, false) = false
      AND (
        c.name ILIKE v_like ESCAPE '\'
        OR c.special_requests ILIKE v_like ESCAPE '\'
        OR c.email ILIKE v_like ESCAPE '\'
        OR c.phone ILIKE v_like ESCAPE '\'
        OR c.emergency_contact ILIKE v_like ESCAPE '\'
      )
    LIMIT v_limit
  ) x;

  IF coalesce(cardinality(v_customer_ids), 0) = 0 THEN
    SELECT coalesce(array_agg(x.id), ARRAY[]::text[])
    INTO v_customer_ids
    FROM (
      SELECT c.id::text AS id
      FROM public.customers c
      WHERE c.operator_id = p_operator_id
        AND c.archive IS TRUE
        AND (
          c.name ILIKE v_like ESCAPE '\'
          OR c.special_requests ILIKE v_like ESCAPE '\'
          OR c.email ILIKE v_like ESCAPE '\'
          OR c.phone ILIKE v_like ESCAPE '\'
          OR c.emergency_contact ILIKE v_like ESCAPE '\'
        )
      LIMIT v_limit
    ) x;
  END IF;

  SELECT coalesce(array_agg(x.id), ARRAY[]::text[])
  INTO v_product_ids
  FROM (
    SELECT p.id::text AS id
    FROM public.products p
    WHERE p.operator_id = p_operator_id
      AND (
        p.name ILIKE v_like ESCAPE '\'
        OR p.name_ko ILIKE v_like ESCAPE '\'
        OR p.name_en ILIKE v_like ESCAPE '\'
        OR p.product_code ILIKE v_like ESCAPE '\'
        OR p.customer_name_ko ILIKE v_like ESCAPE '\'
        OR p.customer_name_en ILIKE v_like ESCAPE '\'
      )
    LIMIT v_limit
  ) x;

  SELECT coalesce(array_agg(x.id), ARRAY[]::text[])
  INTO v_channel_ids
  FROM (
    SELECT ch.id::text AS id
    FROM public.channels ch
    WHERE ch.operator_id = p_operator_id
      AND ch.name ILIKE v_like ESCAPE '\'
    LIMIT v_limit
  ) x;

  RETURN jsonb_build_object(
    'customer_ids', to_jsonb(coalesce(v_customer_ids, ARRAY[]::text[])),
    'product_ids', to_jsonb(coalesce(v_product_ids, ARRAY[]::text[])),
    'channel_ids', to_jsonb(coalesce(v_channel_ids, ARRAY[]::text[]))
  );
END;
$$;

COMMENT ON FUNCTION public.admin_reservation_search_lookup_ids(uuid, text, int) IS
  '예약 관리 검색: customers/products/channels id 보조 조회를 1회 RPC로 통합 (DEFINER)';

GRANT EXECUTE ON FUNCTION public.admin_reservation_search_lookup_ids(uuid, text, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. card-week 활동 구간 ID (created_at ∪ updated_at) — OR 대신 UNION
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reservation_card_week_activity_ids(
  p_operator_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_status text DEFAULT 'all',
  p_channel_id text DEFAULT NULL,
  p_tour_date_start date DEFAULT NULL,
  p_tour_date_end date DEFAULT NULL,
  p_customer_id text DEFAULT NULL,
  p_tier text DEFAULT NULL,
  p_recent_created_gte timestamptz DEFAULT NULL,
  p_legacy_tour_date_cutoff date DEFAULT DATE '2024-12-31',
  p_limit int DEFAULT 500,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_allowed boolean;
  v_limit int := greatest(1, least(coalesce(p_limit, 500), 1000));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_tier text := nullif(btrim(coalesce(p_tier, '')), '');
BEGIN
  SELECT (
    public.rls_is_staff_session_ok()
    OR public.is_team_member(public.current_email())
    OR public.is_team_member_for_session()
    OR public.is_team_member(public.session_email_from_auth_users())
  )
  INTO v_allowed;

  IF NOT coalesce(v_allowed, false) THEN
    RETURN;
  END IF;

  IF p_operator_id IS NULL
     OR p_range_start IS NULL
     OR p_range_end IS NULL THEN
    RETURN;
  END IF;

  IF public.rls_is_staff_session_ok()
     AND NOT public.staff_can_select_operator_row(p_operator_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH created_branch AS (
    SELECT r.id::text AS id, r.created_at
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
      AND (
        v_tier IS NULL
        OR (
          v_tier = 'tier1_recent_modern'
          AND p_recent_created_gte IS NOT NULL
          AND r.created_at >= p_recent_created_gte
          AND (r.tour_date IS NULL OR r.tour_date > p_legacy_tour_date_cutoff)
        )
        OR (
          v_tier = 'tier2_older_modern'
          AND p_recent_created_gte IS NOT NULL
          AND r.created_at < p_recent_created_gte
          AND (r.tour_date IS NULL OR r.tour_date > p_legacy_tour_date_cutoff)
        )
        OR (
          v_tier = 'tier3_legacy_tour'
          AND r.tour_date IS NOT NULL
          AND r.tour_date <= p_legacy_tour_date_cutoff
        )
      )
  ),
  updated_branch AS (
    SELECT r.id::text AS id, r.created_at
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
      AND (
        v_tier IS NULL
        OR (
          v_tier = 'tier1_recent_modern'
          AND p_recent_created_gte IS NOT NULL
          AND r.created_at >= p_recent_created_gte
          AND (r.tour_date IS NULL OR r.tour_date > p_legacy_tour_date_cutoff)
        )
        OR (
          v_tier = 'tier2_older_modern'
          AND p_recent_created_gte IS NOT NULL
          AND r.created_at < p_recent_created_gte
          AND (r.tour_date IS NULL OR r.tour_date > p_legacy_tour_date_cutoff)
        )
        OR (
          v_tier = 'tier3_legacy_tour'
          AND r.tour_date IS NOT NULL
          AND r.tour_date <= p_legacy_tour_date_cutoff
        )
      )
  ),
  merged AS (
    SELECT u.id, u.created_at
    FROM (
      SELECT * FROM created_branch
      UNION ALL
      SELECT * FROM updated_branch
    ) u
  )
  SELECT m.id, m.created_at
  FROM merged m
  ORDER BY m.created_at DESC NULLS LAST, m.id DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.admin_reservation_card_week_activity_ids(
  uuid, timestamptz, timestamptz, text, text, date, date, text, text, timestamptz, date, int, int
) IS
  '예약 관리 card-week: created_at/updated_at 활동 구간을 UNION으로 id 반환 (OR 필터 대체)';

GRANT EXECUTE ON FUNCTION public.admin_reservation_card_week_activity_ids(
  uuid, timestamptz, timestamptz, text, text, date, date, text, text, timestamptz, date, int, int
) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. 목록·필터 복합 인덱스
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reservations_op_status_created_at_id_desc
  ON public.reservations (operator_id, status, created_at DESC, id DESC)
  WHERE status IS DISTINCT FROM 'deleted';

CREATE INDEX IF NOT EXISTS idx_reservations_op_status_channel_tour_date
  ON public.reservations (operator_id, status, channel_id, tour_date DESC)
  WHERE status IS DISTINCT FROM 'deleted';

CREATE INDEX IF NOT EXISTS idx_reservations_op_channel_created_at_id_desc
  ON public.reservations (operator_id, channel_id, created_at DESC, id DESC)
  WHERE status IS DISTINCT FROM 'deleted';

COMMENT ON INDEX public.idx_reservations_op_status_created_at_id_desc IS
  'Admin list/card-flat: tenant + status + created_at sort';

COMMENT ON INDEX public.idx_reservations_op_status_channel_tour_date IS
  'Admin list filters: tenant + status + channel + tour_date range';

COMMENT ON INDEX public.idx_reservations_op_channel_created_at_id_desc IS
  'Admin list: tenant + channel filter + created_at sort';

COMMIT;
