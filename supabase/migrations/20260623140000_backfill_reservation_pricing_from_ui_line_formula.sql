-- reservation_pricing 일괄 보정: 가격 계산 UI·Balance와 맞춘 라인 총액(total_price),
-- 채널 결제(net)→commission_base_price, 채널 수수료·정산, 채널 마스터 commission_percent
--
-- 근거 TS: src/utils/reservationPricingBalance.ts (computeCustomerPaymentTotalLineFormula,
--   effectiveProductPriceTotalForBalance), src/utils/channelSettlement.ts (computeChannelPaymentGrossBeforeReturn,
--   computeChannelPaymentAfterReturn, computeChannelSettlementAmount), src/utils/balanceChannelRevenue.ts
--   (buildReservationPricingMismatchFormulaPatch — commission_base_price = 채널 결제 표시 net)
--
-- ④ company_total_revenue / operating_profit 은 splitNotIncluded·홈페이지·환불 블록 등으로 SQL만으로는
-- 앱과 완전 동일하기 어렵습니다. 이 마이그레이션 적용 후 아래를 한 번 실행하는 것을 권장합니다.
--   npx tsx --tsconfig tsconfig.json scripts/backfill-reservation-pricing-revenue.ts
--
-- 선택: 특정 기간만 돌리려면 최하단 WHERE 절의 주석 조건을 해제하세요.

WITH
opt AS (
  SELECT
    ro.reservation_id,
    ROUND(
      SUM(
        CASE
          WHEN lower(trim(COALESCE(ro.status, 'active'))) IN ('cancelled', 'canceled', 'refunded') THEN 0::numeric
          WHEN ro.total_price IS NOT NULL THEN ro.total_price::numeric
          ELSE COALESCE(ro.ea, 0)::numeric * COALESCE(ro.price, 0)::numeric
        END
      )::numeric,
      2
    ) AS opt_sum
  FROM public.reservation_options ro
  GROUP BY ro.reservation_id
),
pay AS (
  SELECT
    pr.reservation_id,
    COALESCE(SUM(pr.amount) FILTER (WHERE trim(pr.payment_status) = 'Partner Received'), 0)::numeric AS partner_recv,
    COALESCE(
      SUM(pr.amount) FILTER (
        WHERE
          strpos(COALESCE(pr.payment_status, ''), 'Returned') > 0
          OR lower(trim(COALESCE(pr.payment_status, ''))) = 'returned'
      ),
      0
    )::numeric AS returned_sum,
    COALESCE(
      SUM(ABS(pr.amount::numeric)) FILTER (
        WHERE
          trim(pr.payment_status) IN ('환불됨 (우리)', '환불됨(우리)')
          OR pr.payment_status ILIKE '%Refunded%'
          OR lower(trim(COALESCE(pr.payment_status, ''))) = 'refunded'
      ),
      0
    )::numeric AS refunded_our
  FROM public.payment_records pr
  GROUP BY pr.reservation_id
),
calc AS (
  SELECT
    rp.id AS pricing_id,
    rp.reservation_id,
    r.status AS res_status,
    lower(trim(COALESCE(r.status, ''))) AS res_status_l,
    COALESCE(r.adults, 0) + COALESCE(r.child, 0) + COALESCE(r.infant, 0) AS pax_raw,
    GREATEST(
      1,
      COALESCE(NULLIF(rp.pricing_adults, 0), COALESCE(r.adults, 0) + COALESCE(r.child, 0) + COALESCE(r.infant, 0))
    )::numeric AS billing_pax,
    -- channels: commission_percent 우선, 레거시 commission(동일 의미 %) — commission_rate 컬럼은 스키마에 없음
    COALESCE(c.commission_percent, c.commission)::numeric AS ch_commission_pct,
    (
      lower(trim(COALESCE(c.type, ''))) = 'ota'
      OR COALESCE(c.category, '') = 'OTA'
    ) AS is_ota,
    (
      r.channel_id = 'M00001'
      OR lower(COALESCE(c.name, '')) LIKE '%homepage%'
      OR COALESCE(c.name, '') LIKE '%홈페이지%'
    ) AS is_homepage,
    COALESCE(rp.product_price_total, 0)::numeric AS stored_ppt,
    (
      COALESCE(rp.adult_product_price, 0)::numeric * COALESCE(r.adults, 0)::numeric
      + COALESCE(rp.child_product_price, 0)::numeric * COALESCE(r.child, 0)::numeric
      + COALESCE(rp.infant_product_price, 0)::numeric * COALESCE(r.infant, 0)::numeric
    ) AS tier_base,
    COALESCE(rp.not_included_price, 0)::numeric * GREATEST(
      1,
      COALESCE(NULLIF(rp.pricing_adults, 0), COALESCE(r.adults, 0) + COALESCE(r.child, 0) + COALESCE(r.infant, 0))
    )::numeric AS ni_total,
    COALESCE(opt.opt_sum, 0::numeric) AS opt_sum,
    COALESCE(pay.partner_recv, 0::numeric) AS partner_recv,
    COALESCE(pay.returned_sum, 0::numeric) AS returned_sum,
    COALESCE(pay.refunded_our, 0::numeric) AS refunded_our
  FROM public.reservation_pricing rp
  INNER JOIN public.reservations r ON r.id = rp.reservation_id
  LEFT JOIN public.channels c ON c.id = r.channel_id
  LEFT JOIN opt ON opt.reservation_id = rp.reservation_id
  LEFT JOIN pay ON pay.reservation_id = rp.reservation_id
),
calc2 AS (
  SELECT
    c.*,
    (c.stored_ppt + c.ni_total) AS ppt_settlement,
    CASE
      WHEN c.ni_total < 0.005 THEN c.stored_ppt
      WHEN ABS(c.stored_ppt - c.tier_base) <= 0.02
        AND ABS(c.stored_ppt - (c.tier_base + c.ni_total)) > 0.02 THEN c.tier_base + c.ni_total
      ELSE c.stored_ppt
    END::numeric AS product_sum_line,
    COALESCE(NULLIF(c.opt_sum, 0), COALESCE(rp.option_total, 0)::numeric) AS option_total_eff,
    COALESCE(rp.coupon_discount, 0)::numeric AS coupon_d,
    COALESCE(rp.additional_discount, 0)::numeric AS add_disc,
    COALESCE(rp.additional_cost, 0)::numeric AS add_cost,
    COALESCE(rp.tax, 0)::numeric AS tax_v,
    COALESCE(rp.card_fee, 0)::numeric AS card_fee_v,
    COALESCE(rp.prepayment_cost, 0)::numeric AS prepay_cost_v,
    COALESCE(rp.prepayment_tip, 0)::numeric AS prepay_tip_v,
    COALESCE(rp.private_tour_additional_cost, 0)::numeric AS private_tour_v,
    COALESCE(rp.refund_amount, 0)::numeric AS refund_man_v,
    COALESCE(rp.required_option_total, 0)::numeric AS req_opt_v,
    COALESCE(rp.deposit_amount, 0)::numeric AS deposit_v,
    COALESCE(rp.balance_amount, 0)::numeric AS balance_v
  FROM calc c
  INNER JOIN public.reservation_pricing rp ON rp.id = c.pricing_id
),
calc3 AS (
  SELECT
    pricing_id,
    reservation_id,
    res_status_l,
    is_ota,
    is_homepage,
    ch_commission_pct,
    partner_recv,
    returned_sum,
    refunded_our,
    prepay_tip_v,
    ROUND(
      (
        product_sum_line
        - (coupon_d + add_disc)
        + add_cost
        + tax_v
        + card_fee_v
        + prepay_cost_v
        + prepay_tip_v
        + private_tour_v
        - refund_man_v
        + req_opt_v
        + option_total_eff
      )::numeric,
      2
    ) AS line_total_price,
    CASE
      WHEN coupon_d > 0::numeric THEN GREATEST(0::numeric, ppt_settlement - coupon_d - add_disc)
      ELSE ppt_settlement
    END AS ota_product_gross,
    GREATEST(
      0::numeric,
      ppt_settlement - coupon_d + option_total_eff + (add_cost - add_disc) + tax_v + card_fee_v + prepay_tip_v
      - balance_v
    ) AS self_product_subtotal_gross
  FROM calc2
),
calc4 AS (
  SELECT
    pricing_id,
    reservation_id,
    res_status_l,
    is_ota,
    is_homepage,
    ch_commission_pct,
    partner_recv,
    returned_sum,
    refunded_our,
    prepay_tip_v,
    line_total_price,
    ROUND(
      (
        CASE
          WHEN is_ota AND deposit_v > 0 THEN GREATEST(0::numeric, deposit_v)
          WHEN is_ota THEN
            GREATEST(
              0::numeric,
              COALESCE(NULLIF(deposit_v, 0), CASE WHEN ota_product_gross > 0 THEN ota_product_gross ELSE 0::numeric END)
            )
          ELSE
            GREATEST(
              0::numeric,
              CASE
                WHEN self_product_subtotal_gross > 0 THEN self_product_subtotal_gross
                ELSE 0::numeric
              END
            )
        END
        - returned_sum
      )::numeric,
      2
    ) AS channel_pay_net_raw
  FROM (
    SELECT
      c3.*,
      cv.deposit_v
    FROM calc3 c3
    INNER JOIN calc2 cv ON cv.pricing_id = c3.pricing_id
  ) x
),
calc5 AS (
  SELECT
    calc4.pricing_id,
    calc4.reservation_id,
    calc4.res_status_l,
    calc4.is_ota,
    calc4.is_homepage,
    calc4.ch_commission_pct,
    calc4.refunded_our,
    calc4.prepay_tip_v,
    calc4.line_total_price,
    ROUND(
      (
        CASE
          WHEN calc4.is_ota AND calc4.partner_recv > 0::numeric
            AND calc4.channel_pay_net_raw > calc4.partner_recv + 0.005::numeric
            THEN calc4.partner_recv
          ELSE calc4.channel_pay_net_raw
        END
      )::numeric,
      2
    ) AS channel_pay_net,
    CASE
      WHEN calc4.res_status_l IN ('cancelled', 'canceled') THEN 0::numeric
      WHEN calc4.ch_commission_pct IS NOT NULL THEN
        ROUND(
          (
            CASE
              WHEN calc4.is_ota AND calc4.partner_recv > 0::numeric
                AND calc4.channel_pay_net_raw > calc4.partner_recv + 0.005::numeric
                THEN calc4.partner_recv
              ELSE calc4.channel_pay_net_raw
            END
          ) * (calc4.ch_commission_pct / 100::numeric),
          2
        )
      ELSE NULL::numeric
    END AS fee_from_pct,
    CASE
      WHEN calc4.res_status_l IN ('cancelled', 'canceled') THEN 0::numeric
      WHEN calc4.ch_commission_pct IS NULL THEN COALESCE(rp.commission_amount, 0)::numeric
      ELSE NULL::numeric
    END AS fee_fallback_db
  FROM calc4
  INNER JOIN public.reservation_pricing rp ON rp.id = calc4.pricing_id
)
UPDATE public.reservation_pricing rp
SET
  total_price = x.line_total_price,
  commission_base_price = x.channel_pay_net,
  commission_percent = CASE
    WHEN x.ch_commission_pct IS NOT NULL THEN ROUND(x.ch_commission_pct, 4)
    ELSE rp.commission_percent
  END,
  commission_amount = COALESCE(x.fee_from_pct, x.fee_fallback_db, 0)::numeric(12, 2),
  channel_settlement_amount = ROUND(
    (
      GREATEST(
        0::numeric,
        x.channel_pay_net
        - CASE
            WHEN x.res_status_l IN ('cancelled', 'canceled') THEN 0::numeric
            ELSE COALESCE(x.fee_from_pct, x.fee_fallback_db, 0::numeric)
          END
      )
    )::numeric,
    2
  )::numeric(12, 2),
  updated_at = NOW()
FROM calc5 x
WHERE rp.id = x.pricing_id
  AND x.res_status_l <> 'deleted'
  -- AND EXISTS (
  --   SELECT 1 FROM public.reservations r3
  --   WHERE r3.id = rp.reservation_id AND r3.tour_date >= DATE '2026-01-01'
  -- )
;
