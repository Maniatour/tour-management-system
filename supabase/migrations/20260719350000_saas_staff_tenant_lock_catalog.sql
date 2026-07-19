-- Phase 6d.4: Staff tenant lock for admin catalog (products, product_choices, dynamic_pricing).
-- Pattern (SELECT): staff_can_select_operator_row(operator_id) OR is_operator_member_strict(operator_id)
-- Pattern (WRITE): staff_can_select_operator_row(operator_id) — JWT claim absent → unscoped (Kovegas safe).
-- Anon / non-staff customer catalog policies preserved (host routing scopes public reads in app).
-- Depends: staff_can_select_operator_row (6d.0), operator_id on products/choices/dynamic_pricing (1b).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'products.operator_id missing — apply Phase 1b products first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_choices'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'product_choices.operator_id missing — apply Phase 1b product_choices first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dynamic_pricing'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'dynamic_pricing.operator_id missing — apply Phase 1b dynamic_pricing first';
  END IF;

  -- Align child stamps with parent product (fixes DEFAULT-Kovegas inserts under Operator B)
  UPDATE public.product_choices pc
  SET operator_id = p.operator_id
  FROM public.products p
  WHERE pc.product_id = p.id
    AND pc.operator_id IS DISTINCT FROM p.operator_id;

  UPDATE public.dynamic_pricing dp
  SET operator_id = p.operator_id
  FROM public.products p
  WHERE dp.product_id = p.id
    AND dp.operator_id IS DISTINCT FROM p.operator_id;

  -- ---------- products ----------
  ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "products_select_team_full" ON public.products;
  DROP POLICY IF EXISTS "products_select_staff_scoped_or_strict_member" ON public.products;
  DROP POLICY IF EXISTS "products_select_team_member_unscoped" ON public.products;
  DROP POLICY IF EXISTS "products_select_authenticated_active" ON public.products;
  DROP POLICY IF EXISTS "products_insert_staff" ON public.products;
  DROP POLICY IF EXISTS "products_update_staff" ON public.products;
  DROP POLICY IF EXISTS "products_delete_staff" ON public.products;
  DROP POLICY IF EXISTS "products_insert_staff_scoped" ON public.products;
  DROP POLICY IF EXISTS "products_update_staff_scoped" ON public.products;
  DROP POLICY IF EXISTS "products_delete_staff_scoped" ON public.products;

  -- Authenticated active: non-staff keep all-tenant active; staff use JWT-aware helper
  CREATE POLICY "products_select_authenticated_active"
    ON public.products
    FOR SELECT
    TO authenticated
    USING (
      lower(trim(coalesce(status::text, ''))) = 'active'
      AND (
        NOT public.rls_is_staff_session_ok()
        OR public.staff_can_select_operator_row(operator_id)
      )
    );

  CREATE POLICY "products_select_staff_scoped_or_strict_member"
    ON public.products
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- Non-staff team (guides etc.) keep unscoped for reservation forms
  CREATE POLICY "products_select_team_member_unscoped"
    ON public.products
    FOR SELECT
    TO authenticated
    USING (
      public.rls_team_member_session_ok()
      AND NOT public.rls_is_staff_session_ok()
    );

  CREATE POLICY "products_insert_staff_scoped"
    ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "products_update_staff_scoped"
    ON public.products
    FOR UPDATE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id))
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "products_delete_staff_scoped"
    ON public.products
    FOR DELETE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id));

  -- ---------- product_choices ----------
  ALTER TABLE public.product_choices ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "product_choices_select_team" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_select_staff_scoped_or_strict_member"
    ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_select_team_member_unscoped"
    ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_insert_staff" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_update_staff" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_delete_staff" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_insert_staff_scoped" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_update_staff_scoped" ON public.product_choices;
  DROP POLICY IF EXISTS "product_choices_delete_staff_scoped" ON public.product_choices;

  CREATE POLICY "product_choices_select_staff_scoped_or_strict_member"
    ON public.product_choices
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  CREATE POLICY "product_choices_select_team_member_unscoped"
    ON public.product_choices
    FOR SELECT
    TO authenticated
    USING (
      public.rls_team_member_session_ok()
      AND NOT public.rls_is_staff_session_ok()
    );

  CREATE POLICY "product_choices_insert_staff_scoped"
    ON public.product_choices
    FOR INSERT
    TO authenticated
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "product_choices_update_staff_scoped"
    ON public.product_choices
    FOR UPDATE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id))
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "product_choices_delete_staff_scoped"
    ON public.product_choices
    FOR DELETE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id));

  -- ---------- dynamic_pricing ----------
  ALTER TABLE public.dynamic_pricing ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "dynamic_pricing_select_team" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_select_staff" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_select_staff_scoped_or_strict_member"
    ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_select_team_member_unscoped"
    ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_insert_staff" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_update_staff" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_delete_staff" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_insert_staff_scoped" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_update_staff_scoped" ON public.dynamic_pricing;
  DROP POLICY IF EXISTS "dynamic_pricing_delete_staff_scoped" ON public.dynamic_pricing;

  CREATE POLICY "dynamic_pricing_select_staff_scoped_or_strict_member"
    ON public.dynamic_pricing
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  CREATE POLICY "dynamic_pricing_select_team_member_unscoped"
    ON public.dynamic_pricing
    FOR SELECT
    TO authenticated
    USING (
      public.rls_team_member_session_ok()
      AND NOT public.rls_is_staff_session_ok()
    );

  CREATE POLICY "dynamic_pricing_insert_staff_scoped"
    ON public.dynamic_pricing
    FOR INSERT
    TO authenticated
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "dynamic_pricing_update_staff_scoped"
    ON public.dynamic_pricing
    FOR UPDATE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id))
    WITH CHECK (public.staff_can_select_operator_row(operator_id));

  CREATE POLICY "dynamic_pricing_delete_staff_scoped"
    ON public.dynamic_pricing
    FOR DELETE
    TO authenticated
    USING (public.staff_can_select_operator_row(operator_id));
END $$;

CREATE OR REPLACE FUNCTION public.saas_staff_tenant_lock_pilot_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'staff_can_select_operator_row'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'company_expenses'
        AND policyname = 'company_expenses_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'cash_transactions'
        AND policyname = 'cash_transactions_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'financial_accounts'
        AND policyname = 'financial_accounts_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'payment_records'
        AND policyname = 'payment_records_select_staff_scoped_assignee_or_customer'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'statement_imports'
        AND policyname = 'statement_imports_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'statement_lines'
        AND policyname = 'statement_lines_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'reconciliation_matches'
        AND policyname = 'reconciliation_matches_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'expense_cash_ledger_matches'
        AND policyname = 'expense_cash_ledger_matches_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'journal_entries'
        AND policyname = 'journal_entries_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'journal_lines'
        AND policyname = 'journal_lines_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'products'
        AND policyname = 'products_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'product_choices'
        AND policyname = 'product_choices_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'dynamic_pricing'
        AND policyname = 'dynamic_pricing_select_staff_scoped_or_strict_member'
    );
$$;

COMMENT ON FUNCTION public.saas_staff_tenant_lock_pilot_ready() IS
  'Phase 6d.4: true when ops finance + journal + catalog SELECT use JWT-aware staff lock.';

CREATE OR REPLACE FUNCTION public.saas_catalog_staff_tenant_lock_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'products'
        AND policyname = 'products_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'products'
        AND policyname = 'products_update_staff_scoped'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'product_choices'
        AND policyname = 'product_choices_select_staff_scoped_or_strict_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'dynamic_pricing'
        AND policyname = 'dynamic_pricing_select_staff_scoped_or_strict_member'
    );
$$;

COMMENT ON FUNCTION public.saas_catalog_staff_tenant_lock_ready() IS
  'Phase 6d.4: true when products/choices/dynamic_pricing use staff tenant lock policies.';

GRANT EXECUTE ON FUNCTION public.saas_catalog_staff_tenant_lock_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "products_select_staff_scoped_or_strict_member"
  ON public.products IS
  'Phase 6d.4: staff_can_select_operator_row OR is_operator_member_strict.';

COMMENT ON POLICY "products_update_staff_scoped"
  ON public.products IS
  'Phase 6d.4: staff writes scoped when JWT app_metadata.operator_id present.';

COMMENT ON POLICY "product_choices_select_staff_scoped_or_strict_member"
  ON public.product_choices IS
  'Phase 6d.4: staff_can_select_operator_row OR is_operator_member_strict.';

COMMENT ON POLICY "dynamic_pricing_select_staff_scoped_or_strict_member"
  ON public.dynamic_pricing IS
  'Phase 6d.4: staff_can_select_operator_row OR is_operator_member_strict.';

COMMIT;
