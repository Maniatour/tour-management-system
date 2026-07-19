-- Phase 1: SaaS Tenant Foundation
-- Shared DB + operator_id. Kovegas = Tenant #1.
-- Does NOT drop legacy tables. Does NOT tighten all RLS yet.
-- See: docs/adr/001-saas-tenancy-and-modules.txt

--------------------------------------------------------------------------------
-- 1. operators
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'pending')),
  timezone text NOT NULL DEFAULT 'America/Los_Angeles',
  default_currency text NOT NULL DEFAULT 'USD',
  plan_code text NOT NULL DEFAULT 'internal',
  modules jsonb NOT NULL DEFAULT '{"commerce": true, "operations": false}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operators_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.operators IS
  'SaaS tenant (tour supplier). All commerce data is scoped by operator_id.';

COMMENT ON COLUMN public.operators.modules IS
  'Feature modules. commerce=core booking; operations=fleet/guide/expense (Kovegas).';

-- Well-known Kovegas tenant
INSERT INTO public.operators (
  id, name, slug, status, timezone, default_currency, plan_code, modules
) VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'Kovegas / Las Vegas Mania Tour',
  'kovegas',
  'active',
  'America/Los_Angeles',
  'USD',
  'internal',
  '{"commerce": true, "operations": true}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  modules = EXCLUDED.modules,
  updated_at = now();

--------------------------------------------------------------------------------
-- 2. operator_members
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operator_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  user_id uuid NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'ops'
    CHECK (role IN ('owner', 'admin', 'ops', 'finance', 'guide', 'read_only')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operator_members_operator_email_unique UNIQUE (operator_id, email)
);

CREATE INDEX IF NOT EXISTS idx_operator_members_operator
  ON public.operator_members (operator_id);

CREATE INDEX IF NOT EXISTS idx_operator_members_email
  ON public.operator_members (lower(email));

CREATE INDEX IF NOT EXISTS idx_operator_members_user
  ON public.operator_members (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.operator_members IS
  'Users belonging to an operator (tenant). Email is the stable join key during Phase 1.';

-- Backfill from team → Kovegas memberships
INSERT INTO public.operator_members (operator_id, email, role, status, user_id)
SELECT
  'a0000000-0000-4000-8000-000000000001'::uuid,
  lower(trim(t.email)),
  CASE
    WHEN lower(coalesce(t.position, '')) IN ('super', 'admin') THEN 'admin'
    WHEN lower(coalesce(t.position, '')) IN ('manager', 'office_manager') THEN 'admin'
    WHEN lower(coalesce(t.position, '')) IN ('finance', 'accountant') THEN 'finance'
    WHEN lower(coalesce(t.position, '')) IN ('guide', 'driver') THEN 'guide'
    ELSE 'ops'
  END,
  CASE
    WHEN coalesce(t.is_active, true) = false THEN 'disabled'
    ELSE 'active'
  END,
  u.id
FROM public.team t
LEFT JOIN auth.users u ON lower(u.email) = lower(trim(t.email))
WHERE t.email IS NOT NULL
  AND trim(t.email) <> ''
ON CONFLICT (operator_id, email) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  user_id = COALESCE(public.operator_members.user_id, EXCLUDED.user_id),
  updated_at = now();

-- Ensure at least one owner exists (platform bootstrap emails if present in members)
UPDATE public.operator_members
SET role = 'owner', updated_at = now()
WHERE operator_id = 'a0000000-0000-4000-8000-000000000001'::uuid
  AND lower(email) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com')
  AND status = 'active';

-- NOTE: operator_id columns are added in separate migrations
-- (20260718100100+), one table per transaction, to avoid deadlocks
-- from holding AccessExclusiveLock on many hot tables at once.

--------------------------------------------------------------------------------
-- 3. Context helpers (RLS-ready; default operator = Kovegas for Phase 1)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.kovegas_operator_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'a0000000-0000-4000-8000-000000000001'::uuid;
$$;

CREATE OR REPLACE FUNCTION public.current_operator_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  setting_val text;
  claim_val text;
  member_op uuid;
  email_val text;
BEGIN
  -- 1) Explicit session setting (API / service can set)
  setting_val := nullif(current_setting('app.current_operator_id', true), '');
  IF setting_val IS NOT NULL THEN
    RETURN setting_val::uuid;
  END IF;

  -- 2) JWT claim (future): app_metadata.operator_id
  BEGIN
    claim_val := nullif(
      auth.jwt() -> 'app_metadata' ->> 'operator_id',
      ''
    );
    IF claim_val IS NOT NULL THEN
      RETURN claim_val::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3) Resolve from membership by current email (single active membership)
  BEGIN
    email_val := lower(trim(public.current_email()));
  EXCEPTION WHEN OTHERS THEN
    email_val := NULL;
  END;

  IF email_val IS NOT NULL AND email_val <> '' THEN
    SELECT om.operator_id INTO member_op
    FROM public.operator_members om
    WHERE lower(om.email) = email_val
      AND om.status = 'active'
    ORDER BY
      CASE om.role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      om.created_at
    LIMIT 1;

    IF member_op IS NOT NULL THEN
      RETURN member_op;
    END IF;
  END IF;

  -- 4) Phase 1 fallback: Kovegas (single-tenant production)
  RETURN public.kovegas_operator_id();
END;
$$;

CREATE OR REPLACE FUNCTION public.set_current_operator_id(p_operator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF p_operator_id IS NULL THEN
    RAISE EXCEPTION 'operator_id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.operators o WHERE o.id = p_operator_id) THEN
    RAISE EXCEPTION 'unknown operator_id %', p_operator_id;
  END IF;
  PERFORM set_config('app.current_operator_id', p_operator_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_operator_member(p_operator_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  op uuid;
  email_val text;
BEGIN
  -- Platform staff keep access during Phase 1
  BEGIN
    IF public.is_staff() THEN
      RETURN true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  op := COALESCE(p_operator_id, public.current_operator_id());
  BEGIN
    email_val := lower(trim(public.current_email()));
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF email_val IS NULL OR email_val = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.operator_members om
    WHERE om.operator_id = op
      AND lower(om.email) = email_val
      AND om.status = 'active'
  );
END;
$$;

COMMENT ON FUNCTION public.current_operator_id() IS
  'Active SaaS tenant. Order: app.current_operator_id setting → JWT claim → membership → Kovegas fallback.';

COMMENT ON FUNCTION public.set_current_operator_id(uuid) IS
  'Sets request-local app.current_operator_id (transaction-local).';

COMMENT ON FUNCTION public.is_operator_member(uuid) IS
  'True if current user is an active member of the operator (or is_staff in Phase 1).';

--------------------------------------------------------------------------------
-- 4. RLS for new tables (operators / members)
--------------------------------------------------------------------------------
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS operators_select_member_or_staff ON public.operators;
CREATE POLICY operators_select_member_or_staff
  ON public.operators FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.operator_members om
      WHERE om.operator_id = operators.id
        AND lower(om.email) = lower(trim(public.current_email()))
        AND om.status = 'active'
    )
  );

DROP POLICY IF EXISTS operator_members_select_own_or_staff ON public.operator_members;
CREATE POLICY operator_members_select_own_or_staff
  ON public.operator_members FOR SELECT
  TO authenticated
  USING (
    public.is_staff()
    OR lower(email) = lower(trim(public.current_email()))
    OR (
      operator_id = public.current_operator_id()
      AND public.is_operator_member(operator_id)
    )
  );

-- Writes: staff / owner / admin only (Phase 1: staff primary)
DROP POLICY IF EXISTS operators_write_staff ON public.operators;
CREATE POLICY operators_write_staff
  ON public.operators FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS operator_members_write_staff ON public.operator_members;
CREATE POLICY operator_members_write_staff
  ON public.operator_members FOR ALL
  TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

GRANT SELECT ON public.operators TO authenticated, anon;
GRANT SELECT ON public.operator_members TO authenticated;
GRANT ALL ON public.operators TO service_role;
GRANT ALL ON public.operator_members TO service_role;

GRANT EXECUTE ON FUNCTION public.kovegas_operator_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_operator_id() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_current_operator_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_operator_member(uuid) TO authenticated, service_role;
