-- Choice pricing unit: per person vs flat per selected unit (vehicle/room/etc.)
-- Example: airport pickup minivan $80 × 1 vehicle (not × passenger count)

ALTER TABLE public.product_choices
  ADD COLUMN IF NOT EXISTS pricing_unit text NOT NULL DEFAULT 'per_person';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_choices_pricing_unit_check'
      AND conrelid = 'public.product_choices'::regclass
  ) THEN
    ALTER TABLE public.product_choices
      ADD CONSTRAINT product_choices_pricing_unit_check
      CHECK (pricing_unit IN ('per_person', 'per_unit'));
  END IF;
END $$;

COMMENT ON COLUMN public.product_choices.pricing_unit IS
  'per_person: unit price × party size; per_unit: flat price × selected quantity (e.g. vehicle)';
