-- Phase 6b.10: operator_id on reconciliation_matches + expense_cash_ledger_matches
-- Backfill from statement_lines / cash_transactions; expense-source fallback; orphan → Kovegas.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- reconciliation_matches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reconciliation_matches'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.reconciliation_matches ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.reconciliation_matches rm
  SET operator_id = sl.operator_id
  FROM public.statement_lines sl
  WHERE rm.statement_line_id = sl.id
    AND rm.operator_id IS NULL
    AND sl.operator_id IS NOT NULL;

  UPDATE public.reconciliation_matches rm
  SET operator_id = ce.operator_id
  FROM public.company_expenses ce
  WHERE rm.source_table = 'company_expenses'
    AND rm.source_id = ce.id
    AND rm.operator_id IS NULL
    AND ce.operator_id IS NOT NULL;

  UPDATE public.reconciliation_matches rm
  SET operator_id = te.operator_id
  FROM public.tour_expenses te
  WHERE rm.source_table = 'tour_expenses'
    AND rm.source_id = te.id
    AND rm.operator_id IS NULL
    AND te.operator_id IS NOT NULL;

  UPDATE public.reconciliation_matches rm
  SET operator_id = re.operator_id
  FROM public.reservation_expenses re
  WHERE rm.source_table = 'reservation_expenses'
    AND rm.source_id = re.id
    AND rm.operator_id IS NULL
    AND re.operator_id IS NOT NULL;

  UPDATE public.reconciliation_matches rm
  SET operator_id = ct.operator_id
  FROM public.cash_transactions ct
  WHERE rm.source_table = 'cash_transactions'
    AND rm.source_id = ct.id
    AND rm.operator_id IS NULL
    AND ct.operator_id IS NOT NULL;

  UPDATE public.reconciliation_matches
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.reconciliation_matches
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.reconciliation_matches
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.reconciliation_matches
      ADD CONSTRAINT reconciliation_matches_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- expense_cash_ledger_matches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expense_cash_ledger_matches'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.expense_cash_ledger_matches ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.expense_cash_ledger_matches m
  SET operator_id = ct.operator_id
  FROM public.cash_transactions ct
  WHERE m.cash_transaction_id = ct.id
    AND m.operator_id IS NULL
    AND ct.operator_id IS NOT NULL;

  UPDATE public.expense_cash_ledger_matches m
  SET operator_id = ce.operator_id
  FROM public.company_expenses ce
  WHERE m.expense_source_table = 'company_expenses'
    AND m.expense_source_id = ce.id
    AND m.operator_id IS NULL
    AND ce.operator_id IS NOT NULL;

  UPDATE public.expense_cash_ledger_matches m
  SET operator_id = te.operator_id
  FROM public.tour_expenses te
  WHERE m.expense_source_table = 'tour_expenses'
    AND m.expense_source_id = te.id
    AND m.operator_id IS NULL
    AND te.operator_id IS NOT NULL;

  UPDATE public.expense_cash_ledger_matches m
  SET operator_id = re.operator_id
  FROM public.reservation_expenses re
  WHERE m.expense_source_table = 'reservation_expenses'
    AND m.expense_source_id = re.id
    AND m.operator_id IS NULL
    AND re.operator_id IS NOT NULL;

  UPDATE public.expense_cash_ledger_matches
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.expense_cash_ledger_matches
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.expense_cash_ledger_matches
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.expense_cash_ledger_matches
      ADD CONSTRAINT expense_cash_ledger_matches_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_operator_id
  ON public.reconciliation_matches (operator_id);

CREATE INDEX IF NOT EXISTS idx_expense_cash_ledger_matches_operator_id
  ON public.expense_cash_ledger_matches (operator_id);

COMMENT ON COLUMN public.reconciliation_matches.operator_id IS
  'SaaS tenant owning this statement↔ledger match. Backfilled from statement_lines. Phase 6b.10.';

COMMENT ON COLUMN public.expense_cash_ledger_matches.operator_id IS
  'SaaS tenant owning this expense↔cash match. Backfilled from cash_transactions. Phase 6b.10.';
