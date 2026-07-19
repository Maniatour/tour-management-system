-- Phase 6d.2: Expand staff tenant lock to statement + recon match tables.
-- Pattern (same as 6d.0–6d.1):
--   staff_can_select_operator_row(operator_id)
--   OR is_operator_member_strict(operator_id)
-- Writes unchanged. SAAS_STAFF_TENANT_LOCK still gates JWT stamp (app).

BEGIN;

DO $$
BEGIN
  -- ---- statement_imports ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'statement_imports'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'statement_imports.operator_id missing — apply Phase 6b.9 first';
  END IF;

  ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "statement_imports_select_staff" ON public.statement_imports;
  DROP POLICY IF EXISTS "statement_imports_select_staff_or_member"
    ON public.statement_imports;
  DROP POLICY IF EXISTS "statement_imports_select_staff_scoped_or_strict_member"
    ON public.statement_imports;

  CREATE POLICY "statement_imports_select_staff_scoped_or_strict_member"
    ON public.statement_imports
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- ---- statement_lines ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'statement_lines'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'statement_lines.operator_id missing — apply Phase 6b.9 first';
  END IF;

  ALTER TABLE public.statement_lines ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "statement_lines_select_staff" ON public.statement_lines;
  DROP POLICY IF EXISTS "statement_lines_select_staff_or_member"
    ON public.statement_lines;
  DROP POLICY IF EXISTS "statement_lines_select_staff_scoped_or_strict_member"
    ON public.statement_lines;

  CREATE POLICY "statement_lines_select_staff_scoped_or_strict_member"
    ON public.statement_lines
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- ---- reconciliation_matches ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reconciliation_matches'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'reconciliation_matches.operator_id missing — apply Phase 6b.10 first';
  END IF;

  ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "reconciliation_matches_select_staff"
    ON public.reconciliation_matches;
  DROP POLICY IF EXISTS "reconciliation_matches_select_staff_or_member"
    ON public.reconciliation_matches;
  DROP POLICY IF EXISTS "reconciliation_matches_select_staff_scoped_or_strict_member"
    ON public.reconciliation_matches;

  CREATE POLICY "reconciliation_matches_select_staff_scoped_or_strict_member"
    ON public.reconciliation_matches
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- ---- expense_cash_ledger_matches ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expense_cash_ledger_matches'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'expense_cash_ledger_matches.operator_id missing — apply Phase 6b.10 first';
  END IF;

  ALTER TABLE public.expense_cash_ledger_matches ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "expense_cash_ledger_matches_select_staff"
    ON public.expense_cash_ledger_matches;
  DROP POLICY IF EXISTS "expense_cash_ledger_matches_select_staff_or_member"
    ON public.expense_cash_ledger_matches;
  DROP POLICY IF EXISTS "expense_cash_ledger_matches_select_staff_scoped_or_strict_member"
    ON public.expense_cash_ledger_matches;

  CREATE POLICY "expense_cash_ledger_matches_select_staff_scoped_or_strict_member"
    ON public.expense_cash_ledger_matches
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );
END $$;

-- Full finance lock surface (6d.0–6d.2)
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
    );
$$;

COMMENT ON FUNCTION public.saas_staff_tenant_lock_pilot_ready() IS
  'Phase 6d.2: true when ops finance SELECT tables use JWT-aware staff lock.';

CREATE OR REPLACE FUNCTION public.saas_ops_finance_select_rls_ready()
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
      WHERE schemaname = 'public' AND tablename = 'cash_transactions'
        AND policyname IN (
          'cash_transactions_select_staff_or_member',
          'cash_transactions_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'financial_accounts'
        AND policyname IN (
          'financial_accounts_select_staff_or_member',
          'financial_accounts_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'statement_imports'
        AND policyname IN (
          'statement_imports_select_staff_or_member',
          'statement_imports_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'statement_lines'
        AND policyname IN (
          'statement_lines_select_staff_or_member',
          'statement_lines_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reconciliation_matches'
        AND policyname IN (
          'reconciliation_matches_select_staff_or_member',
          'reconciliation_matches_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'expense_cash_ledger_matches'
        AND policyname IN (
          'expense_cash_ledger_matches_select_staff_or_member',
          'expense_cash_ledger_matches_select_staff_scoped_or_strict_member'
        )
    );
$$;

COMMENT ON POLICY "statement_imports_select_staff_scoped_or_strict_member"
  ON public.statement_imports IS
  'Phase 6d.2: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "statement_lines_select_staff_scoped_or_strict_member"
  ON public.statement_lines IS
  'Phase 6d.2: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "reconciliation_matches_select_staff_scoped_or_strict_member"
  ON public.reconciliation_matches IS
  'Phase 6d.2: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "expense_cash_ledger_matches_select_staff_scoped_or_strict_member"
  ON public.expense_cash_ledger_matches IS
  'Phase 6d.2: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMIT;
