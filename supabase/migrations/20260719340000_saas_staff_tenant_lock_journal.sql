-- Phase 6d.3: Expand staff tenant lock to journal_entries + journal_lines.
-- Pattern (same as 6d.0–6d.2):
--   staff_can_select_operator_row(operator_id)
--   OR is_operator_member_strict(operator_id)
-- Writes / card-payment stamp unchanged. SAAS_STAFF_TENANT_LOCK gates JWT (app).

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'journal_entries.operator_id missing — apply Phase 6c.4 first';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_lines'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'journal_lines.operator_id missing — apply Phase 6c.4 first';
  END IF;

  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "journal_entries_select_staff" ON public.journal_entries;
  DROP POLICY IF EXISTS "journal_entries_select_staff_or_member"
    ON public.journal_entries;
  DROP POLICY IF EXISTS "journal_entries_select_staff_scoped_or_strict_member"
    ON public.journal_entries;

  CREATE POLICY "journal_entries_select_staff_scoped_or_strict_member"
    ON public.journal_entries
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  DROP POLICY IF EXISTS "journal_lines_select_staff" ON public.journal_lines;
  DROP POLICY IF EXISTS "journal_lines_select_staff_or_member"
    ON public.journal_lines;
  DROP POLICY IF EXISTS "journal_lines_select_staff_scoped_or_strict_member"
    ON public.journal_lines;

  CREATE POLICY "journal_lines_select_staff_scoped_or_strict_member"
    ON public.journal_lines
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );
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
    );
$$;

COMMENT ON FUNCTION public.saas_staff_tenant_lock_pilot_ready() IS
  'Phase 6d.3: true when ops finance + journal SELECT use JWT-aware staff lock.';

CREATE OR REPLACE FUNCTION public.saas_journal_select_rls_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'journal_entries'
        AND column_name = 'operator_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'journal_lines'
        AND column_name = 'operator_id'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'journal_entries'
        AND policyname IN (
          'journal_entries_select_staff_or_member',
          'journal_entries_select_staff_scoped_or_strict_member'
        )
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'journal_lines'
        AND policyname IN (
          'journal_lines_select_staff_or_member',
          'journal_lines_select_staff_scoped_or_strict_member'
        )
    );
$$;

COMMENT ON POLICY "journal_entries_select_staff_scoped_or_strict_member"
  ON public.journal_entries IS
  'Phase 6d.3: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "journal_lines_select_staff_scoped_or_strict_member"
  ON public.journal_lines IS
  'Phase 6d.3: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMIT;
