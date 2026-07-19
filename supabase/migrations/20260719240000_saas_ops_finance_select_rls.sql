-- Phase 6c.2: Ops finance SELECT RLS — operator_members path (same soft pattern as 6c.1).
-- Tables: cash_transactions, financial_accounts, statement_imports, statement_lines,
--         reconciliation_matches, expense_cash_ledger_matches
-- INSERT/UPDATE/DELETE unchanged (staff / statement uploaders).
-- Staff check uses rls_is_staff_session_ok() (preserves team-session fallback from 20260621260000).
-- Non-goals: booking/payment logic; staff cross-tenant lock-down; journal_* RLS.

BEGIN;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'cash_transactions',
    'financial_accounts',
    'statement_imports',
    'statement_lines',
    'reconciliation_matches',
    'expense_cash_ledger_matches'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      RAISE EXCEPTION 'Phase 6c.2: table % missing', t;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'operator_id'
    ) THEN
      RAISE EXCEPTION
        'Phase 6c.2: %.operator_id missing — apply Phase 6b.8–6b.10 migrations first',
        t;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  -- ---- cash_transactions ----
  DROP POLICY IF EXISTS "cash_transactions_select_staff" ON public.cash_transactions;
  DROP POLICY IF EXISTS "cash_transactions_select_staff_or_member" ON public.cash_transactions;
  CREATE POLICY "cash_transactions_select_staff_or_member"
    ON public.cash_transactions FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- financial_accounts ----
  DROP POLICY IF EXISTS "financial_accounts_select_staff" ON public.financial_accounts;
  DROP POLICY IF EXISTS "financial_accounts_select_staff_or_member" ON public.financial_accounts;
  CREATE POLICY "financial_accounts_select_staff_or_member"
    ON public.financial_accounts FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- statement_imports ----
  DROP POLICY IF EXISTS "statement_imports_select_staff" ON public.statement_imports;
  DROP POLICY IF EXISTS "statement_imports_select_staff_or_member" ON public.statement_imports;
  CREATE POLICY "statement_imports_select_staff_or_member"
    ON public.statement_imports FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- statement_lines ----
  DROP POLICY IF EXISTS "statement_lines_select_staff" ON public.statement_lines;
  DROP POLICY IF EXISTS "statement_lines_select_staff_or_member" ON public.statement_lines;
  CREATE POLICY "statement_lines_select_staff_or_member"
    ON public.statement_lines FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- reconciliation_matches ----
  DROP POLICY IF EXISTS "reconciliation_matches_select_staff" ON public.reconciliation_matches;
  DROP POLICY IF EXISTS "reconciliation_matches_select_staff_or_member" ON public.reconciliation_matches;
  CREATE POLICY "reconciliation_matches_select_staff_or_member"
    ON public.reconciliation_matches FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  -- ---- expense_cash_ledger_matches ----
  DROP POLICY IF EXISTS "expense_cash_ledger_matches_select_staff"
    ON public.expense_cash_ledger_matches;
  DROP POLICY IF EXISTS "expense_cash_ledger_matches_select_staff_or_member"
    ON public.expense_cash_ledger_matches;
  CREATE POLICY "expense_cash_ledger_matches_select_staff_or_member"
    ON public.expense_cash_ledger_matches FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );
END $$;

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
        AND policyname = 'cash_transactions_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'financial_accounts'
        AND policyname = 'financial_accounts_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'statement_imports'
        AND policyname = 'statement_imports_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'statement_lines'
        AND policyname = 'statement_lines_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reconciliation_matches'
        AND policyname = 'reconciliation_matches_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'expense_cash_ledger_matches'
        AND policyname = 'expense_cash_ledger_matches_select_staff_or_member'
    );
$$;

COMMENT ON FUNCTION public.saas_ops_finance_select_rls_ready() IS
  'Phase 6c.2: true when cash/statement/match SELECT policies include operator_members path.';

GRANT EXECUTE ON FUNCTION public.saas_ops_finance_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "cash_transactions_select_staff_or_member"
  ON public.cash_transactions IS
  'Phase 6c.2: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "financial_accounts_select_staff_or_member"
  ON public.financial_accounts IS
  'Phase 6c.2: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "statement_imports_select_staff_or_member"
  ON public.statement_imports IS
  'Phase 6c.2: staff session OR operator member. Upload write policies unchanged.';

COMMENT ON POLICY "statement_lines_select_staff_or_member"
  ON public.statement_lines IS
  'Phase 6c.2: staff session OR operator member. Upload/update write policies unchanged.';

COMMENT ON POLICY "reconciliation_matches_select_staff_or_member"
  ON public.reconciliation_matches IS
  'Phase 6c.2: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "expense_cash_ledger_matches_select_staff_or_member"
  ON public.expense_cash_ledger_matches IS
  'Phase 6c.2: staff session OR operator member. Writes unchanged.';

COMMIT;
