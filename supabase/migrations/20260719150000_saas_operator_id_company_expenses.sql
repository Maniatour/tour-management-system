-- Phase 6b.3: operator_id on company_expenses (ops_finance root)
-- Backfill all existing rows to Kovegas. View company_expenses_no_statement_match
-- uses SELECT ce.* so the new column is included automatically.
-- No schema rename/move; reservation_expenses / tour_expenses deferred.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_expenses'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.company_expenses
      ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.company_expenses
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.company_expenses
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.company_expenses
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.company_expenses
      ADD CONSTRAINT company_expenses_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_expenses_operator_id
  ON public.company_expenses (operator_id);

COMMENT ON COLUMN public.company_expenses.operator_id IS
  'SaaS tenant owning this company expense. Phase 6b.3; Kovegas backfill.';
