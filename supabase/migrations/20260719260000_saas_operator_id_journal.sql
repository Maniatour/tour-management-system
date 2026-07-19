-- Phase 6c.4: operator_id on journal_entries + journal_lines + SELECT RLS (member path).
-- Backfill: statement_imports → financial_accounts (via lines) → Kovegas.
-- Writes (INSERT/UPDATE/DELETE) stay staff-session only.
-- Depends: financial_accounts / statement_imports operator_id (6b.8–6b.9),
--          rls_is_staff_session_ok(), is_operator_member().

BEGIN;

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- ---- journal_entries ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_entries'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.journal_entries ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.journal_entries je
  SET operator_id = si.operator_id
  FROM public.statement_imports si
  WHERE je.statement_import_id = si.id
    AND je.operator_id IS NULL
    AND si.operator_id IS NOT NULL;

  UPDATE public.journal_entries je
  SET operator_id = sub.operator_id
  FROM (
    SELECT jl.journal_entry_id, MIN(fa.operator_id::text)::uuid AS operator_id
    FROM public.journal_lines jl
    INNER JOIN public.financial_accounts fa ON fa.id = jl.financial_account_id
    WHERE fa.operator_id IS NOT NULL
    GROUP BY jl.journal_entry_id
    HAVING COUNT(DISTINCT fa.operator_id) = 1
  ) sub
  WHERE je.id = sub.journal_entry_id
    AND je.operator_id IS NULL;

  UPDATE public.journal_entries
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.journal_entries
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.journal_entries
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.journal_entries
      ADD CONSTRAINT journal_entries_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- ---- journal_lines ----
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'journal_lines'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.journal_lines ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.journal_lines jl
  SET operator_id = je.operator_id
  FROM public.journal_entries je
  WHERE jl.journal_entry_id = je.id
    AND jl.operator_id IS NULL
    AND je.operator_id IS NOT NULL;

  UPDATE public.journal_lines jl
  SET operator_id = fa.operator_id
  FROM public.financial_accounts fa
  WHERE jl.financial_account_id = fa.id
    AND jl.operator_id IS NULL
    AND fa.operator_id IS NOT NULL;

  UPDATE public.journal_lines
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.journal_lines
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.journal_lines
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.journal_lines
      ADD CONSTRAINT journal_lines_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_operator_id
  ON public.journal_entries (operator_id);

CREATE INDEX IF NOT EXISTS idx_journal_lines_operator_id
  ON public.journal_lines (operator_id);

COMMENT ON COLUMN public.journal_entries.operator_id IS
  'SaaS tenant owning this journal entry. Backfill: statement_imports / financial_accounts. Phase 6c.4.';

COMMENT ON COLUMN public.journal_lines.operator_id IS
  'SaaS tenant owning this journal line. Copied from entry / financial_accounts. Phase 6c.4.';

-- ---- SELECT RLS (soft member path) ----
DO $$
BEGIN
  ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "journal_entries_select_staff" ON public.journal_entries;
  DROP POLICY IF EXISTS "journal_entries_select_staff_or_member" ON public.journal_entries;
  CREATE POLICY "journal_entries_select_staff_or_member"
    ON public.journal_entries FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );

  DROP POLICY IF EXISTS "journal_lines_select_staff" ON public.journal_lines;
  DROP POLICY IF EXISTS "journal_lines_select_staff_or_member" ON public.journal_lines;
  CREATE POLICY "journal_lines_select_staff_or_member"
    ON public.journal_lines FOR SELECT TO authenticated
    USING (
      public.rls_is_staff_session_ok()
      OR public.is_operator_member(operator_id)
    );
END $$;

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
        AND policyname = 'journal_entries_select_staff_or_member'
    )
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'journal_lines'
        AND policyname = 'journal_lines_select_staff_or_member'
    );
$$;

COMMENT ON FUNCTION public.saas_journal_select_rls_ready() IS
  'Phase 6c.4: true when journal_* have operator_id and SELECT member policies.';

GRANT EXECUTE ON FUNCTION public.saas_journal_select_rls_ready()
  TO authenticated, service_role;

COMMENT ON POLICY "journal_entries_select_staff_or_member"
  ON public.journal_entries IS
  'Phase 6c.4: staff session OR operator member. Writes unchanged.';

COMMENT ON POLICY "journal_lines_select_staff_or_member"
  ON public.journal_lines IS
  'Phase 6c.4: staff session OR operator member. Writes unchanged.';

COMMIT;
