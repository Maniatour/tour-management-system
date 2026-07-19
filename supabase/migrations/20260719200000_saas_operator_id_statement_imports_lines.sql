-- Phase 6b.9: denormalized operator_id on statement_imports + statement_lines
-- Backfill from financial_accounts (imports) then parent import (lines).
-- Orphan → Kovegas. Enables list/pool queries without joining accounts.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- statement_imports
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'statement_imports'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.statement_imports ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.statement_imports si
  SET operator_id = fa.operator_id
  FROM public.financial_accounts fa
  WHERE si.financial_account_id = fa.id
    AND si.operator_id IS NULL
    AND fa.operator_id IS NOT NULL;

  UPDATE public.statement_imports
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.statement_imports
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.statement_imports
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.statement_imports
      ADD CONSTRAINT statement_imports_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- statement_lines
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'statement_lines'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.statement_lines ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.statement_lines sl
  SET operator_id = si.operator_id
  FROM public.statement_imports si
  WHERE sl.statement_import_id = si.id
    AND sl.operator_id IS NULL
    AND si.operator_id IS NOT NULL;

  UPDATE public.statement_lines
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.statement_lines
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.statement_lines
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.statement_lines
      ADD CONSTRAINT statement_lines_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_statement_imports_operator_id
  ON public.statement_imports (operator_id);

CREATE INDEX IF NOT EXISTS idx_statement_lines_operator_id
  ON public.statement_lines (operator_id);

COMMENT ON COLUMN public.statement_imports.operator_id IS
  'SaaS tenant owning this statement import. Backfilled from financial_accounts. Phase 6b.9.';

COMMENT ON COLUMN public.statement_lines.operator_id IS
  'SaaS tenant owning this statement line. Backfilled from statement_imports. Phase 6b.9.';
