-- 예약 처리 필요 / Follow-up 운영 큐: 전 테이블 스캔 대신 후보 id만 반환
CREATE OR REPLACE FUNCTION public.admin_operational_queue_candidate_ids(p_customer_id text DEFAULT NULL)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
    AND (
      /* 상태: 7일 이내 투어 + pending */
      (
        lower(btrim(coalesce(r.status, ''))) = 'pending'
        AND r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
        AND r.tour_date <= b.day7
      )
      /* 미완성 draft */
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'pending'
        AND r.customer_id IS NULL
        AND r.product_id IS NULL
        AND (
          r.tour_id IS NULL
          OR btrim(r.tour_id) = ''
          OR lower(btrim(r.tour_id)) IN ('null', 'undefined')
        )
      )
      /* 투어 미배정 (Mania confirmed) */
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'confirmed'
        AND mp.id IS NOT NULL
        AND (
          r.tour_id IS NULL
          OR btrim(r.tour_id) = ''
          OR lower(btrim(r.tour_id)) IN ('null', 'undefined')
        )
      )
      /* Follow-up: 오늘 이후 투어(문의·취소 제외) */
      OR (
        r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
        AND lower(btrim(coalesce(r.status, ''))) NOT IN ('inquiry', 'cancelled', 'canceled')
      )
      /* Follow-up 취소 큐 */
      OR (
        lower(btrim(coalesce(r.status, ''))) IN ('cancelled', 'canceled')
        AND r.tour_date IS NOT NULL
        AND r.tour_date >= b.today
      )
      /* 밸런스: 지난 투어 + 잔액 */
      OR (
        r.tour_date IS NOT NULL
        AND r.tour_date < b.today
        AND coalesce(rp.balance_amount, 0) > 0.01
      )
      /* 가격 없음 */
      OR (
        lower(btrim(coalesce(r.status, ''))) NOT LIKE 'cancelled%'
        AND lower(btrim(coalesce(r.status, ''))) NOT IN ('canceled')
        AND (rp.reservation_id IS NULL OR coalesce(rp.total_price, 0) <= 0)
      )
      /* 입금 기록 있음 */
      OR EXISTS (
        SELECT 1 FROM public.payment_records pr
        WHERE pr.reservation_id = r.id
      )
      /* confirmed · 입금 없음 */
      OR (
        lower(btrim(coalesce(r.status, ''))) = 'confirmed'
        AND NOT EXISTS (
          SELECT 1 FROM public.payment_records pr
          WHERE pr.reservation_id = r.id
        )
      )
      /* 취소 · 금액 정리 후보 */
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

COMMENT ON FUNCTION public.admin_operational_queue_candidate_ids(text) IS
  '예약 처리 필요·Follow-up 운영 큐 후보 예약 id (전량 reservations 스캔 방지)';

GRANT EXECUTE ON FUNCTION public.admin_operational_queue_candidate_ids(text) TO authenticated;
