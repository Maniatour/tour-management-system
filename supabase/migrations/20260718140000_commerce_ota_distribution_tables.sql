-- Phase 4a: OTA Distribution foundation (additive)
-- channel_connections + external_mappings + sync_events (outbox)
-- Default OFF: no outbound API until COMMERCE_V2_OTA_SYNC=1 and connection status != disabled.
-- See: docs/adr/007-commerce-v2-ota-distribution.txt

--------------------------------------------------------------------------------
-- channel_connections: operator ↔ OTA platform link
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channel_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  channel_id text NULL REFERENCES public.channels(id) ON DELETE SET NULL,
  platform text NOT NULL
    CHECK (platform IN ('viator', 'klook', 'gyg', 'kkday', 'trip', 'other')),
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('disabled', 'dry_run', 'active', 'error')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials_ref text NULL,
  conflict_policy text NOT NULL DEFAULT 'internal_wins'
    CHECK (conflict_policy IN ('internal_wins', 'channel_wins', 'manual_review')),
  last_synced_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_connections_operator_platform_name_unique
    UNIQUE (operator_id, platform, display_name)
);

CREATE INDEX IF NOT EXISTS idx_channel_connections_operator_platform
  ON public.channel_connections (operator_id, platform);

COMMENT ON COLUMN public.channel_connections.credentials_ref IS
  'Vault / secret manager reference only — never store raw API secrets in config for production.';
COMMENT ON COLUMN public.channel_connections.status IS
  'disabled=no sync; dry_run=build payload only; active=real adapter calls (future).';

--------------------------------------------------------------------------------
-- external_mappings: internal entity ↔ OTA SKU/package
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL
    REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  internal_type text NOT NULL
    CHECK (internal_type IN ('product', 'offer', 'rate_plan', 'choice_option')),
  internal_id text NOT NULL,
  external_sku text NOT NULL,
  external_product_id text NULL,
  external_package_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT external_mappings_connection_sku_unique
    UNIQUE (connection_id, external_sku)
);

CREATE INDEX IF NOT EXISTS idx_external_mappings_internal
  ON public.external_mappings (operator_id, internal_type, internal_id)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_external_mappings_connection
  ON public.external_mappings (connection_id)
  WHERE is_active = true;

COMMENT ON TABLE public.external_mappings IS
  'OTA package/SKU ↔ internal Offer/Product. Unmapped SKUs must not create bookings by name heuristic.';

--------------------------------------------------------------------------------
-- sync_events: transactional outbox for OTA workers
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  connection_id uuid NULL
    REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'push_rates',
      'push_availability',
      'push_content',
      'pull_bookings',
      'reconcile'
    )),
  entity_type text NOT NULL
    CHECK (entity_type IN (
      'product',
      'offer',
      'rate_plan',
      'allotment',
      'reservation'
    )),
  entity_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  available_at timestamptz NOT NULL DEFAULT now(),
  last_error text NULL,
  result jsonb NULL,
  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_events_idempotency
  ON public.sync_events (operator_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sync_events_outbox_poll
  ON public.sync_events (status, available_at, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_sync_events_connection_created
  ON public.sync_events (connection_id, created_at DESC);

COMMENT ON TABLE public.sync_events IS
  'OTA sync outbox. Workers claim pending rows and call platform adapters.';

--------------------------------------------------------------------------------
-- updated_at
--------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_channel_connections_updated_at ON public.channel_connections;
CREATE TRIGGER trg_channel_connections_updated_at
  BEFORE UPDATE ON public.channel_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_external_mappings_updated_at ON public.external_mappings;
CREATE TRIGGER trg_external_mappings_updated_at
  BEFORE UPDATE ON public.external_mappings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_sync_events_updated_at ON public.sync_events;
CREATE TRIGGER trg_sync_events_updated_at
  BEFORE UPDATE ON public.sync_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'channel_connections',
    'external_mappings',
    'sync_events'
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

--------------------------------------------------------------------------------
-- Seed: Kovegas Viator connection in dry_run (no live API)
--------------------------------------------------------------------------------
INSERT INTO public.channel_connections (
  id,
  operator_id,
  channel_id,
  platform,
  display_name,
  status,
  config,
  conflict_policy
) VALUES (
  'c0000000-0000-4000-8000-000000000001'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  NULL,
  'viator',
  'Viator (dry-run)',
  'dry_run',
  '{"mode":"dry_run","note":"Phase 4a scaffold — no live API calls"}'::jsonb,
  'internal_wins'
)
ON CONFLICT (operator_id, platform, display_name) DO NOTHING;
