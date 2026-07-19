-- Phase 2: Commerce Core v2 (additive — does not alter dynamic_pricing)
-- New empty tables for RatePlan / Offer / Rule / Override.
-- Legacy dynamic_pricing remains SSOT for reads until cutover.
-- See: docs/pricing-architecture-v2-greenfield.txt
--      docs/adr/001-saas-tenancy-and-modules.txt

--------------------------------------------------------------------------------
-- rate_plans: pricing policy per product × channel × variant
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  channel_id text NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  variant_key text NOT NULL DEFAULT 'default',
  pricing_mode text NOT NULL DEFAULT 'hybrid'
    CHECK (pricing_mode IN ('rule_based', 'offer_fixed', 'hybrid')),
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  legacy_price_type text NULL
    CHECK (legacy_price_type IS NULL OR legacy_price_type IN ('dynamic', 'base')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_plans_operator_product_channel_variant_unique
    UNIQUE (operator_id, product_id, channel_id, variant_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_plans_operator ON public.rate_plans (operator_id);
CREATE INDEX IF NOT EXISTS idx_rate_plans_product_channel
  ON public.rate_plans (product_id, channel_id);

COMMENT ON TABLE public.rate_plans IS
  'v2 pricing policy container (product × channel × variant). Dual-written from dynamic_pricing.';

--------------------------------------------------------------------------------
-- price_rules: base + choice adjustments (rule_based / hybrid)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  rule_type text NOT NULL
    CHECK (rule_type IN ('base', 'choice_adjustment', 'channel_adjustment')),
  scope_type text NOT NULL DEFAULT 'rate_plan'
    CHECK (scope_type IN ('rate_plan', 'choice_option', 'choice_key')),
  scope_key text NULL,
  adult_amount numeric(12, 2) NOT NULL DEFAULT 0,
  child_amount numeric(12, 2) NOT NULL DEFAULT 0,
  infant_amount numeric(12, 2) NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 100,
  effective_from date NULL,
  effective_to date NULL,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'dual_write',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_rules_rate_plan ON public.price_rules (rate_plan_id);
CREATE INDEX IF NOT EXISTS idx_price_rules_operator ON public.price_rules (operator_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_rules_unique_active_scope
  ON public.price_rules (rate_plan_id, rule_type, scope_type, COALESCE(scope_key, ''))
  WHERE is_active = true AND effective_from IS NULL AND effective_to IS NULL;

COMMENT ON TABLE public.price_rules IS
  'v2 rule-based amounts. base = plan base; choice_adjustment = base_plus deltas.';

--------------------------------------------------------------------------------
-- offers: sellable units (Pricing Category / SKU)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NULL,
  creation_mode text NOT NULL DEFAULT 'imported'
    CHECK (creation_mode IN ('curated', 'generated', 'imported', 'dual_write')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_rate_plan_code_unique UNIQUE (rate_plan_id, code)
);

CREATE INDEX IF NOT EXISTS idx_offers_operator ON public.offers (operator_id);
CREATE INDEX IF NOT EXISTS idx_offers_rate_plan ON public.offers (rate_plan_id);

COMMENT ON TABLE public.offers IS
  'v2 sellable SKU. code mirrors legacy choices_pricing key when dual-written.';

--------------------------------------------------------------------------------
-- offer_components: offer ↔ choice mapping (opaque keys OK in Phase 2)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  offer_id uuid NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  component_key text NOT NULL,
  choice_option_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_components_offer_key_unique UNIQUE (offer_id, component_key)
);

CREATE INDEX IF NOT EXISTS idx_offer_components_offer ON public.offer_components (offer_id);

--------------------------------------------------------------------------------
-- price_overrides: sparse date prices (offer-level or plan-level)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.price_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  offer_id uuid NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  date date NOT NULL,
  adult_price numeric(12, 2) NOT NULL DEFAULT 0,
  child_price numeric(12, 2) NOT NULL DEFAULT 0,
  infant_price numeric(12, 2) NOT NULL DEFAULT 0,
  ota_sale_price numeric(12, 2) NULL,
  not_included_price numeric(12, 2) NULL,
  is_sale_available boolean NOT NULL DEFAULT true,
  commission_percent numeric(8, 4) NULL,
  markup_amount numeric(12, 2) NULL,
  markup_percent numeric(8, 4) NULL,
  coupon_percent numeric(8, 4) NULL,
  source text NOT NULL DEFAULT 'dual_write',
  legacy_dynamic_pricing_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_overrides_plan_offer_date
  ON public.price_overrides (
    rate_plan_id,
    COALESCE(offer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    date
  );

CREATE INDEX IF NOT EXISTS idx_price_overrides_date ON public.price_overrides (date);
CREATE INDEX IF NOT EXISTS idx_price_overrides_operator_date
  ON public.price_overrides (operator_id, date);

COMMENT ON TABLE public.price_overrides IS
  'v2 sparse date prices. offer_id NULL = plan-level (no-choice / base row).';

--------------------------------------------------------------------------------
-- stop_sells: date closed flags (optional companion to is_sale_available)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stop_sells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  offer_id uuid NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text NULL,
  source text NOT NULL DEFAULT 'dual_write',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stop_sells_plan_offer_date
  ON public.stop_sells (
    rate_plan_id,
    COALESCE(offer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    date
  );

--------------------------------------------------------------------------------
-- updated_at trigger
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at_commerce_v2()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_plans_updated_at ON public.rate_plans;
CREATE TRIGGER trg_rate_plans_updated_at
  BEFORE UPDATE ON public.rate_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_price_rules_updated_at ON public.price_rules;
CREATE TRIGGER trg_price_rules_updated_at
  BEFORE UPDATE ON public.price_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_offers_updated_at ON public.offers;
CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_price_overrides_updated_at ON public.price_overrides;
CREATE TRIGGER trg_price_overrides_updated_at
  BEFORE UPDATE ON public.price_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

--------------------------------------------------------------------------------
-- RLS (staff write; member/staff read). No changes to legacy table policies.
--------------------------------------------------------------------------------
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stop_sells ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rate_plans', 'price_rules', 'offers', 'offer_components', 'price_overrides', 'stop_sells'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_staff_or_member', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
         USING (public.is_staff() OR public.is_operator_member(operator_id))',
      t || '_select_staff_or_member', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write_staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (public.is_staff())
         WITH CHECK (public.is_staff())',
      t || '_write_staff', t
    );

    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Anon read of open catalog prices not enabled yet (Direct Web still uses dynamic_pricing)
