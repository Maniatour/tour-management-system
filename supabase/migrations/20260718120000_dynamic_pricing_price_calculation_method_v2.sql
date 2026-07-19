-- Align price_calculation_method with app ChoicePricingMode (absolute | base_plus).
-- Legacy CHECK only allowed additive | override | percentage, which caused 23514 on save.

ALTER TABLE public.dynamic_pricing
  DROP CONSTRAINT IF EXISTS dynamic_pricing_price_calculation_method_check;

-- Normalize legacy labels to current app vocabulary before tightening CHECK.
UPDATE public.dynamic_pricing
SET price_calculation_method = CASE
  WHEN price_calculation_method = 'additive' THEN 'absolute'
  WHEN price_calculation_method = 'override' THEN 'absolute'
  WHEN price_calculation_method = 'percentage' THEN 'absolute'
  ELSE price_calculation_method
END
WHERE price_calculation_method IS DISTINCT FROM 'absolute'
  AND price_calculation_method IS DISTINCT FROM 'base_plus';

ALTER TABLE public.dynamic_pricing
  ADD CONSTRAINT dynamic_pricing_price_calculation_method_check
  CHECK (
    price_calculation_method IS NULL
    OR price_calculation_method = ANY (ARRAY['absolute'::text, 'base_plus'::text])
  );

COMMENT ON CONSTRAINT dynamic_pricing_price_calculation_method_check ON public.dynamic_pricing IS
  'absolute = choice final price; base_plus = base + choice adjustment';
