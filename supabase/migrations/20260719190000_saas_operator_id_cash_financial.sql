-- Phase 6b.8: operator_id on cash_transactions + financial_accounts
-- Both backfill to Kovegas (cash has no parent FK; accounts are tenant roots).
-- statement_imports / statement_lines inherit via financial_account_id (no column this slice).

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- cash_transactions
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cash_transactions'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.cash_transactions ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.cash_transactions
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.cash_transactions
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.cash_transactions
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.cash_transactions
      ADD CONSTRAINT cash_transactions_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- financial_accounts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financial_accounts'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.financial_accounts ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.financial_accounts
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.financial_accounts
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.financial_accounts
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.financial_accounts
      ADD CONSTRAINT financial_accounts_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_operator_id
  ON public.cash_transactions (operator_id);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_operator_id
  ON public.financial_accounts (operator_id);

COMMENT ON COLUMN public.cash_transactions.operator_id IS
  'SaaS tenant owning this cash ledger row. Phase 6b.8; Kovegas backfill.';

COMMENT ON COLUMN public.financial_accounts.operator_id IS
  'SaaS tenant owning this financial account. Statement imports inherit via FK. Phase 6b.8.';
