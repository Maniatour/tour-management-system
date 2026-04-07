-- Fix channel_settlement_amount for all reservation_pricing rows.
-- Correct formula (UI 가격 계산 §3·§4 와 일치):
--   채널 수수료 $ = commission_amount
--     (NULL 이면 commission_base_price * COALESCE(commission_percent,0) / 100)
--   channel_settlement_amount = GREATEST(0, commission_base_price - 채널 수수료 $)
--
-- 이전 백필(20260404210000)은 복잡한 식으로 commission_base_price 와 동일하게 잘못 들어간 경우가 있음.

BEGIN;

UPDATE public.reservation_pricing
SET channel_settlement_amount = ROUND(
  GREATEST(
    0::numeric,
    COALESCE(commission_base_price, 0) - COALESCE(
      commission_amount,
      COALESCE(commission_base_price, 0) * COALESCE(commission_percent, 0) / 100.0
    )
  ),
  2
)::numeric(12, 2);

COMMENT ON COLUMN public.reservation_pricing.channel_settlement_amount IS
  '채널 정산 금액 = commission_base_price − 채널 수수료$. 수수료는 commission_amount 우선, 없으면 base×percent/100. 음수 방지 GREATEST(0,·).';

COMMIT;
