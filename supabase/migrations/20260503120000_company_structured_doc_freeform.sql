-- SOP / 직원 계약서: 자유 서식(한 페이지) 초안 컬럼 + 작성 스냅샷(작성일 조회)

ALTER TABLE public.company_sop_draft
  ADD COLUMN IF NOT EXISTS freeform_markdown text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.company_sop_draft.freeform_markdown IS '워드형 자유 서식 탭 본문(리치 마크다운 문자열)';

ALTER TABLE public.company_employee_contract_draft
  ADD COLUMN IF NOT EXISTS freeform_markdown text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.company_employee_contract_draft.freeform_markdown IS '워드형 자유 서식 탭 본문(리치 마크다운 문자열)';

CREATE TABLE IF NOT EXISTS public.company_structured_doc_freeform_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind text NOT NULL CHECK (doc_kind IN ('sop', 'employee_contract')),
  body_markdown text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_structured_doc_freeform_snapshots_kind_created
  ON public.company_structured_doc_freeform_snapshots (doc_kind, created_at DESC);

COMMENT ON TABLE public.company_structured_doc_freeform_snapshots IS 'SOP·직원 계약서 자유 서식 탭의 저장 스냅샷(작성일 기준 조회)';

ALTER TABLE public.company_structured_doc_freeform_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "structured_doc_freeform_snapshots_select_managers"
  ON public.company_structured_doc_freeform_snapshots;
CREATE POLICY "structured_doc_freeform_snapshots_select_managers"
  ON public.company_structured_doc_freeform_snapshots FOR SELECT TO authenticated
  USING (public.can_manage_company_sop());

DROP POLICY IF EXISTS "structured_doc_freeform_snapshots_insert_managers"
  ON public.company_structured_doc_freeform_snapshots;
CREATE POLICY "structured_doc_freeform_snapshots_insert_managers"
  ON public.company_structured_doc_freeform_snapshots FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());
