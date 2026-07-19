-- Phase 3b: Booking commerce snapshot on reservations (additive, nullable)
-- New Direct Web bookings may store offer / money breakdown / inventory hold ids.
-- Legacy rows remain NULL; settlement reads existing reservation_pricing unchanged.
-- See: docs/adr/006-commerce-v2-booking-snapshot.txt

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS commerce_offer_id uuid NULL
    REFERENCES public.offers(id) ON DELETE SET NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS commerce_rate_plan_id uuid NULL
    REFERENCES public.rate_plans(id) ON DELETE SET NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS commerce_pricing_source text NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS money_breakdown_json jsonb NULL;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS inventory_hold_ids uuid[] NULL;

COMMENT ON COLUMN public.reservations.commerce_offer_id IS
  'v2 offers.id matched at booking time (nullable; analytics only).';
COMMENT ON COLUMN public.reservations.commerce_rate_plan_id IS
  'v2 rate_plans.id used at booking time (nullable).';
COMMENT ON COLUMN public.reservations.commerce_pricing_source IS
  'Price engine label, e.g. commerce_v2_offer_fixed | calculate_dynamic_price | catalog_fallback.';
COMMENT ON COLUMN public.reservations.money_breakdown_json IS
  'Immutable commercial snapshot at booking create (lines, pax, totals). Not recomputed later.';
COMMENT ON COLUMN public.reservations.inventory_hold_ids IS
  'inventory_holds.id list created for this reservation (v2 inventory flag path).';

CREATE INDEX IF NOT EXISTS idx_reservations_commerce_offer_id
  ON public.reservations (commerce_offer_id)
  WHERE commerce_offer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_commerce_rate_plan_id
  ON public.reservations (commerce_rate_plan_id)
  WHERE commerce_rate_plan_id IS NOT NULL;
