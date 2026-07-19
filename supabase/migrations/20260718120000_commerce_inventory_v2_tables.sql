-- Phase 3: Inventory Core v2 (additive — does not change legacy booking)
-- Resources / allotments / bindings / holds / ledger
-- Enforcement is OFF until COMMERCE_V2_INVENTORY_PRODUCTS is set.
-- See: docs/pricing-architecture-v2-greenfield.txt

--------------------------------------------------------------------------------
-- resources: capacity pools (shared seats, ticket pools, etc.)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  capacity_type text NOT NULL DEFAULT 'shared'
    CHECK (capacity_type IN ('shared', 'exclusive', 'channel_allotment')),
  unit_label text NOT NULL DEFAULT 'seat',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_resources_operator_code_unique UNIQUE (operator_id, code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_resources_operator
  ON public.inventory_resources (operator_id);

COMMENT ON TABLE public.inventory_resources IS
  'v2 inventory pool (e.g. tour seats, antelope tickets).';

--------------------------------------------------------------------------------
-- allotments: date(+optional time) capacity for a resource
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_allotments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.inventory_resources(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NULL,
  total_qty integer NOT NULL DEFAULT 0 CHECK (total_qty >= 0),
  held_qty integer NOT NULL DEFAULT 0 CHECK (held_qty >= 0),
  sold_qty integer NOT NULL DEFAULT 0 CHECK (sold_qty >= 0),
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_allotments_qty_ok CHECK (held_qty + sold_qty <= total_qty)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_allotments_resource_date_time
  ON public.inventory_allotments (
    resource_id,
    date,
    COALESCE(start_time, '00:00:00'::time)
  );

CREATE INDEX IF NOT EXISTS idx_inventory_allotments_operator_date
  ON public.inventory_allotments (operator_id, date);

COMMENT ON COLUMN public.inventory_allotments.version IS
  'Optimistic concurrency token for hold/commit races.';

--------------------------------------------------------------------------------
-- bindings: product / offer / choice_option → resource consumption
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.inventory_resources(id) ON DELETE CASCADE,
  scope_type text NOT NULL
    CHECK (scope_type IN ('product', 'offer', 'choice_option', 'rate_plan')),
  scope_id text NOT NULL,
  qty_per_guest numeric(8, 2) NOT NULL DEFAULT 1 CHECK (qty_per_guest > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_bindings_unique UNIQUE (resource_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_bindings_scope
  ON public.inventory_bindings (operator_id, scope_type, scope_id);

COMMENT ON TABLE public.inventory_bindings IS
  'Which sellable scopes consume which resource pools.';

--------------------------------------------------------------------------------
-- holds: short-lived reservations before payment commit
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  allotment_id uuid NOT NULL REFERENCES public.inventory_allotments(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.inventory_resources(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  status text NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'committed', 'released', 'expired')),
  reservation_id text NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_holds_reservation
  ON public.inventory_holds (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_holds_active_expiry
  ON public.inventory_holds (status, expires_at)
  WHERE status = 'held';

--------------------------------------------------------------------------------
-- ledger: append-only movements
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.inventory_resources(id) ON DELETE CASCADE,
  allotment_id uuid NULL REFERENCES public.inventory_allotments(id) ON DELETE SET NULL,
  hold_id uuid NULL REFERENCES public.inventory_holds(id) ON DELETE SET NULL,
  reservation_id text NULL,
  movement_type text NOT NULL
    CHECK (movement_type IN ('adjust', 'hold', 'commit', 'release', 'expire')),
  qty_delta integer NOT NULL,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_ledger_resource_created
  ON public.inventory_ledger (resource_id, created_at DESC);

--------------------------------------------------------------------------------
-- updated_at triggers
--------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_inventory_resources_updated_at ON public.inventory_resources;
CREATE TRIGGER trg_inventory_resources_updated_at
  BEFORE UPDATE ON public.inventory_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_inventory_allotments_updated_at ON public.inventory_allotments;
CREATE TRIGGER trg_inventory_allotments_updated_at
  BEFORE UPDATE ON public.inventory_allotments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

DROP TRIGGER IF EXISTS trg_inventory_holds_updated_at ON public.inventory_holds;
CREATE TRIGGER trg_inventory_holds_updated_at
  BEFORE UPDATE ON public.inventory_holds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_commerce_v2();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.inventory_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_allotments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_resources',
    'inventory_allotments',
    'inventory_bindings',
    'inventory_holds',
    'inventory_ledger'
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
-- Seed helper: default shared seat pool for Kovegas (no allotments yet)
--------------------------------------------------------------------------------
INSERT INTO public.inventory_resources (
  id, operator_id, code, name, capacity_type, unit_label, is_active
) VALUES (
  'b0000000-0000-4000-8000-000000000001'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'default_shared_seats',
  'Default Shared Tour Seats',
  'shared',
  'seat',
  true
)
ON CONFLICT (operator_id, code) DO NOTHING;
