-- 명세 매칭 시 누가 저장했는지 추적
begin;

ALTER TABLE public.reconciliation_matches
  ADD COLUMN IF NOT EXISTS matched_by TEXT,
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.reconciliation_matches.matched_by IS '매칭 저장 시 관리자 이메일 등';

commit;
