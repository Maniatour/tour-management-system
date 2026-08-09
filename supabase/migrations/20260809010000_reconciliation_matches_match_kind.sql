-- reconciliation_matches: 자동/수동 구분 (품질 측정·재학습용)
ALTER TABLE public.reconciliation_matches
  ADD COLUMN IF NOT EXISTS match_kind text;

ALTER TABLE public.reconciliation_matches
  DROP CONSTRAINT IF EXISTS reconciliation_matches_match_kind_check;

ALTER TABLE public.reconciliation_matches
  ADD CONSTRAINT reconciliation_matches_match_kind_check
  CHECK (match_kind IS NULL OR match_kind IN ('manual', 'auto'));

COMMENT ON COLUMN public.reconciliation_matches.match_kind IS
  'manual = 사용자 연결, auto = 자동 매칭 적용. NULL = 과거 데이터.';

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_match_kind
  ON public.reconciliation_matches (match_kind)
  WHERE match_kind IS NOT NULL;
