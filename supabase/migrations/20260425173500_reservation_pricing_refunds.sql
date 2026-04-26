ALTER TABLE public.reservation_pricing
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_amount numeric(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.reservation_pricing.refund_reason IS
  'Manual refund reason entered in reservation pricing.';

COMMENT ON COLUMN public.reservation_pricing.refund_amount IS
  'Manual refund amount deducted from revenue/profit calculations.';
