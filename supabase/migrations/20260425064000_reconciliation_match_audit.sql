-- Track who originally saved a reconciliation match and who later changed it.

ALTER TABLE public.reconciliation_matches
  ADD COLUMN IF NOT EXISTS updated_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.reconciliation_matches.updated_by IS '마지막으로 매칭 출처를 수정한 사용자 이메일';
COMMENT ON COLUMN public.reconciliation_matches.updated_at IS '마지막으로 매칭 출처를 수정한 시각';

CREATE TABLE IF NOT EXISTS public.reconciliation_match_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  match_id TEXT,
  statement_line_id TEXT NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  actor_email TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  before_source_table TEXT,
  before_source_id TEXT,
  after_source_table TEXT,
  after_source_id TEXT,
  before_matched_amount NUMERIC(14, 2),
  after_matched_amount NUMERIC(14, 2)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_match_events_line
  ON public.reconciliation_match_events(statement_line_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_match_events_match
  ON public.reconciliation_match_events(match_id, occurred_at DESC);

ALTER TABLE public.reconciliation_match_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reconciliation_match_events'
      AND policyname = 'reconciliation_match_events_select_all'
  ) THEN
    CREATE POLICY "reconciliation_match_events_select_all"
      ON public.reconciliation_match_events FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reconciliation_match_events'
      AND policyname = 'reconciliation_match_events_insert_staff'
  ) THEN
    CREATE POLICY "reconciliation_match_events_insert_staff"
      ON public.reconciliation_match_events FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT ON TABLE public.reconciliation_match_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reconciliation_match_events TO service_role;
