-- Phase 6d.1: Expand staff tenant lock pilot to cash / accounts / payment_records.
-- Same helper as 6d.0: staff_can_select_operator_row (JWT claim absent → unscoped).
-- Non-staff: is_operator_member_strict. payment_records keeps assignee + customer.
-- Writes unchanged. SAAS_STAFF_TENANT_LOCK still controls JWT stamp (app).

BEGIN;

DO $$
BEGIN
  -- ---- cash_transactions ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cash_transactions'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'cash_transactions.operator_id missing — apply Phase 6b.8 first';
  END IF;

  ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "cash_transactions_select_staff" ON public.cash_transactions;
  DROP POLICY IF EXISTS "cash_transactions_select_staff_or_member"
    ON public.cash_transactions;
  DROP POLICY IF EXISTS "cash_transactions_select_staff_scoped_or_strict_member"
    ON public.cash_transactions;

  CREATE POLICY "cash_transactions_select_staff_scoped_or_strict_member"
    ON public.cash_transactions
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- ---- financial_accounts ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_accounts'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'financial_accounts.operator_id missing — apply Phase 6b.8 first';
  END IF;

  ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "financial_accounts_select_staff" ON public.financial_accounts;
  DROP POLICY IF EXISTS "financial_accounts_select_staff_or_member"
    ON public.financial_accounts;
  DROP POLICY IF EXISTS "financial_accounts_select_staff_scoped_or_strict_member"
    ON public.financial_accounts;

  CREATE POLICY "financial_accounts_select_staff_scoped_or_strict_member"
    ON public.financial_accounts
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
    );

  -- ---- payment_records ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'operator_id'
  ) THEN
    RAISE EXCEPTION 'payment_records.operator_id missing — apply Phase 6b.11 first';
  END IF;

  ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "payment_records_select_staff_or_assignee"
    ON public.payment_records;
  DROP POLICY IF EXISTS "payment_records_select_staff_member_assignee_or_customer"
    ON public.payment_records;
  DROP POLICY IF EXISTS "payment_records_select_staff_scoped_assignee_or_customer"
    ON public.payment_records;

  CREATE POLICY "payment_records_select_staff_scoped_assignee_or_customer"
    ON public.payment_records
    FOR SELECT
    TO authenticated
    USING (
      public.staff_can_select_operator_row(operator_id)
      OR public.is_operator_member_strict(operator_id)
      OR (
        reservation_id IS NOT NULL
        AND public.reservation_expense_row_accessible_as_assignee(reservation_id)
      )
      OR (
        reservation_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.reservations r
          INNER JOIN public.customers c ON c.id = r.customer_id
          WHERE r.id = reservation_id
            AND lower(trim(coalesce(c.email, ''))) =
                lower(trim(coalesce(public.current_email(), '')))
        )
      )
    );
END $$;

-- Expand smoke: company_expenses + cash + accounts + payment_records
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
    );
$$;

COMMENT ON FUNCTION public.saas_staff_tenant_lock_pilot_ready() IS
  'Phase 6d.1: true when company_expenses/cash/accounts/payment_records use JWT-aware staff lock.';

-- Keep earlier smokes green after policy rename
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

CREATE OR REPLACE FUNCTION public.saas_payment_records_select_rls_ready()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_records'
      AND policyname IN (
        'payment_records_select_staff_member_assignee_or_customer',
        'payment_records_select_staff_scoped_assignee_or_customer'
      )
  );
$$;

COMMENT ON POLICY "cash_transactions_select_staff_scoped_or_strict_member"
  ON public.cash_transactions IS
  'Phase 6d.1: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "financial_accounts_select_staff_scoped_or_strict_member"
  ON public.financial_accounts IS
  'Phase 6d.1: staff_can_select_operator_row OR is_operator_member_strict. Writes unchanged.';

COMMENT ON POLICY "payment_records_select_staff_scoped_assignee_or_customer"
  ON public.payment_records IS
  'Phase 6d.1: staff scoped OR strict member OR assignee OR customer. Writes unchanged.';

COMMIT;
