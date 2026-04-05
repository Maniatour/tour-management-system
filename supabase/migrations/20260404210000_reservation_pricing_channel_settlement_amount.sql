-- Persist channel settlement amount (채널 정산 금액) aligned with PricingSection / 가격 계산 UI.
-- Adds commission_base_price if missing (채널 결제 gross; form onlinePaymentAmount 와 동기).

ALTER TABLE public.reservation_pricing
  ADD COLUMN IF NOT EXISTS commission_base_price NUMERIC(12, 2);

ALTER TABLE public.reservation_pricing
  ADD COLUMN IF NOT EXISTS channel_settlement_amount NUMERIC(12, 2);

COMMENT ON COLUMN public.reservation_pricing.commission_base_price IS
  'OTA/채널 결제 gross (UI commission_base_price / onlinePaymentAmount). Returned 차감 전 기준.';

COMMENT ON COLUMN public.reservation_pricing.channel_settlement_amount IS
  '채널 정산 금액 = 채널 결제(표시, Returned 반영) − 채널 수수료$. 취소 예약은 수수료 0.';

-- ---------------------------------------------------------------------------
-- Backfill: partner received / returned / OTA 여부 / 예약 상태 반영
-- ---------------------------------------------------------------------------

WITH
partner_recv AS (
  SELECT reservation_id, SUM(amount)::numeric AS total
  FROM public.payment_records
  WHERE payment_status = 'Partner Received'
  GROUP BY reservation_id
),
returned_sum AS (
  SELECT
    reservation_id,
    SUM(amount)::numeric AS total
  FROM public.payment_records
  WHERE
    strpos(COALESCE(payment_status, ''), 'Returned') > 0
    OR lower(trim(COALESCE(payment_status, ''))) = 'returned'
  GROUP BY reservation_id
),
upd AS (
  SELECT
    rp.id AS pricing_id,
    GREATEST(
      0,
      GREATEST(
        0,
        CASE
          WHEN COALESCE(rp.deposit_amount, 0) > 0 THEN
            COALESCE(NULLIF(rp.commission_base_price, 0), rp.deposit_amount)
          WHEN (
            lower(COALESCE(c.type, '')) = 'ota'
            OR COALESCE(c.category, '') = 'OTA'
          ) THEN
            COALESCE(
              NULLIF(rp.commission_base_price, 0),
              NULLIF(rp.deposit_amount, 0),
              NULLIF(pr.total, 0),
              CASE
                WHEN COALESCE(rp.coupon_discount, 0) > 0 THEN
                  GREATEST(
                    0,
                    COALESCE(rp.product_price_total, 0)
                    - COALESCE(rp.coupon_discount, 0)
                    - COALESCE(rp.additional_discount, 0)
                  )
                ELSE COALESCE(rp.product_price_total, 0)
              END,
              0
            )
          ELSE
            COALESCE(
              NULLIF(rp.commission_base_price, 0),
              NULLIF(
                (COALESCE(rp.product_price_total, 0) - COALESCE(rp.coupon_discount, 0))
                + COALESCE(rp.option_total, 0)
                + (COALESCE(rp.additional_cost, 0) - COALESCE(rp.additional_discount, 0))
                + COALESCE(rp.tax, 0)
                + COALESCE(rp.card_fee, 0)
                + COALESCE(rp.prepayment_tip, 0)
                - COALESCE(rp.balance_amount, 0),
                0
              ),
              NULLIF(rp.deposit_amount, 0),
              0
            )
        END
        - COALESCE(rs.total, 0)
      )
      - CASE
          WHEN lower(trim(COALESCE(r.status, ''))) IN ('cancelled', 'canceled') THEN 0
          ELSE COALESCE(rp.commission_amount, 0)
        END
    )::numeric(12, 2) AS settlement
  FROM public.reservation_pricing rp
  INNER JOIN public.reservations r ON r.id = rp.reservation_id
  LEFT JOIN public.channels c ON c.id = r.channel_id
  LEFT JOIN partner_recv pr ON pr.reservation_id = rp.reservation_id
  LEFT JOIN returned_sum rs ON rs.reservation_id = rp.reservation_id
)
UPDATE public.reservation_pricing rp
SET channel_settlement_amount = upd.settlement
FROM upd
WHERE rp.id = upd.pricing_id;

-- commission_base_price 가 비어 있고 Partner Received 만 있는 경우 gross 보정 (기존 UI와 맞춤)
UPDATE public.reservation_pricing rp
SET commission_base_price = pr.total
FROM (
  SELECT reservation_id, SUM(amount)::numeric AS total
  FROM public.payment_records
  WHERE payment_status = 'Partner Received'
  GROUP BY reservation_id
) pr
WHERE rp.reservation_id = pr.reservation_id
  AND (rp.commission_base_price IS NULL OR rp.commission_base_price = 0)
  AND COALESCE(pr.total, 0) <> 0;
