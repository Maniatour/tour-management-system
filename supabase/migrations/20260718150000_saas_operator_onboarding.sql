-- Phase 5a: Operator onboarding fields (additive)
-- Subdomain / Stripe Connect stubs / plan_limits for second-tenant pilot.
-- Public self-serve signup and live Connect are later; staff creates operators via admin API.
-- See: docs/adr/008-saas-operator-onboarding.txt

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS subdomain text NULL;

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS custom_domain text NULL;

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text NULL;

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS stripe_connect_status text NOT NULL DEFAULT 'not_started'
    CHECK (stripe_connect_status IN (
      'not_started',
      'pending',
      'restricted',
      'enabled',
      'disabled'
    ));

ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS plan_limits jsonb NOT NULL DEFAULT '{
    "max_products": 50,
    "max_members": 20,
    "max_channels": 30
  }'::jsonb;

-- Unique subdomain when set (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_subdomain_unique
  ON public.operators (lower(subdomain))
  WHERE subdomain IS NOT NULL AND trim(subdomain) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_custom_domain_unique
  ON public.operators (lower(custom_domain))
  WHERE custom_domain IS NOT NULL AND trim(custom_domain) <> '';

COMMENT ON COLUMN public.operators.subdomain IS
  'Customer site host label (e.g. acme → acme.platform…). Phase 5a stores only; routing later.';
COMMENT ON COLUMN public.operators.stripe_connect_account_id IS
  'Stripe Connect account id (acct_…). Populated when Connect onboarding completes.';
COMMENT ON COLUMN public.operators.stripe_connect_status IS
  'Connect lifecycle stub until Express/Standard onboarding is wired.';
COMMENT ON COLUMN public.operators.plan_limits IS
  'Soft plan caps: max_products, max_members, max_channels (enforced in app gradually).';

-- Keep Kovegas subdomain aligned with slug
UPDATE public.operators
SET
  subdomain = 'kovegas',
  plan_limits = '{
    "max_products": 500,
    "max_members": 200,
    "max_channels": 100
  }'::jsonb,
  stripe_connect_status = COALESCE(stripe_connect_status, 'not_started'),
  updated_at = now()
WHERE id = 'a0000000-0000-4000-8000-000000000001'::uuid;
