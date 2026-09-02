-- 클룩 예약 reservation_pricing: 채널 마스터 commission %로 수수료%·수수료$ 일괄 보정
--
-- 수수료 $ = 채널 결제 금액(commission_base_price, 없으면 deposit_amount) × 채널 수수료% / 100
-- 채널 정산 금액 = max(0, 채널 결제 금액 − 수수료 $)
-- 삭제(deleted) 예약은 제외. 동적가격 22.5% 등 채널 마스터와 어긋난 저장값을 덮어씀.

WITH klook_channels AS (
  SELECT
    c.id,
    CASE
      WHEN COALESCE(c.commission_percent, c.commission) IS NULL THEN NULL
      WHEN COALESCE(c.commission_percent, c.commission) > 0
        AND COALESCE(c.commission_percent, c.commission) < 1
        THEN ROUND((COALESCE(c.commission_percent, c.commission) * 100)::numeric, 4)
      ELSE ROUND(COALESCE(c.commission_percent, c.commission)::numeric, 4)
    END AS master_pct
  FROM public.channels c
  WHERE
    lower(c.id) = 'klook'
    OR lower(c.id) LIKE '%klook%'
    OR lower(COALESCE(c.name, '')) LIKE '%klook%'
    OR COALESCE(c.name, '') LIKE '%클룩%'
),
src AS (
  SELECT
    rp.id AS pricing_id,
    kc.master_pct,
    GREATEST(
      0::numeric,
      COALESCE(
        NULLIF(rp.commission_base_price, 0),
        rp.deposit_amount,
        0
      )
    )::numeric AS pay_base
  FROM public.reservation_pricing rp
  INNER JOIN public.reservations r ON r.id = rp.reservation_id
  INNER JOIN klook_channels kc ON kc.id = r.channel_id
  WHERE lower(trim(COALESCE(r.status, ''))) <> 'deleted'
    AND kc.master_pct IS NOT NULL
    AND kc.master_pct > 0
),
calc AS (
  SELECT
    pricing_id,
    master_pct,
    pay_base,
    ROUND(pay_base * (master_pct / 100.0), 2) AS fee_usd
  FROM src
)
UPDATE public.reservation_pricing rp
SET
  commission_percent = c.master_pct,
  commission_amount = c.fee_usd,
  channel_settlement_amount = ROUND(GREATEST(0::numeric, c.pay_base - c.fee_usd), 2),
  updated_at = NOW()
FROM calc c
WHERE rp.id = c.pricing_id
  AND (
    COALESCE(rp.commission_percent, 0) IS DISTINCT FROM c.master_pct
    OR ROUND(COALESCE(rp.commission_amount, 0)::numeric, 2) IS DISTINCT FROM c.fee_usd
    OR ROUND(COALESCE(rp.channel_settlement_amount, 0)::numeric, 2)
      IS DISTINCT FROM ROUND(GREATEST(0::numeric, c.pay_base - c.fee_usd), 2)
  );
