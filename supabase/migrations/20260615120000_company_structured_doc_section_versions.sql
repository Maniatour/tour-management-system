-- SOP / 직원 계약서 섹션 버전 테이블·RPC (원격에 20260503 미적용 시에도 이 파일로 일괄 반영 가능)

CREATE TABLE IF NOT EXISTS public.company_structured_doc_section_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind text NOT NULL CHECK (doc_kind IN ('sop', 'employee_contract')),
  section_id uuid NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  section_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_structured_doc_section_versions_unique_rev UNIQUE (doc_kind, section_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_structured_doc_section_versions_doc_section_rev
  ON public.company_structured_doc_section_versions (doc_kind, section_id, revision DESC);

COMMENT ON TABLE public.company_structured_doc_section_versions IS '회사 SOP·직원 계약서 본문의 섹션별 저장 이력(섹션 id 기준 최신본 조회)';

CREATE OR REPLACE FUNCTION public.company_structured_doc_section_versions_set_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(revision), 0) + 1 INTO NEW.revision
  FROM public.company_structured_doc_section_versions
  WHERE doc_kind = NEW.doc_kind AND section_id = NEW.section_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_structured_doc_section_versions_revision ON public.company_structured_doc_section_versions;
CREATE TRIGGER trg_structured_doc_section_versions_revision
  BEFORE INSERT ON public.company_structured_doc_section_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.company_structured_doc_section_versions_set_revision();

CREATE OR REPLACE FUNCTION public.company_structured_doc_section_versions_latest(p_doc_kind text)
RETURNS SETOF public.company_structured_doc_section_versions
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (v.section_id) v.*
  FROM public.company_structured_doc_section_versions v
  WHERE v.doc_kind = p_doc_kind
  ORDER BY v.section_id, v.revision DESC, v.created_at DESC;
$$;

COMMENT ON FUNCTION public.company_structured_doc_section_versions_latest(text) IS 'doc_kind별 섹션 id당 최신 revision 한 행씩 반환';

ALTER TABLE public.company_structured_doc_section_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_structured_doc_section_versions_select_managers"
  ON public.company_structured_doc_section_versions;
CREATE POLICY "company_structured_doc_section_versions_select_managers"
  ON public.company_structured_doc_section_versions FOR SELECT TO authenticated
  USING (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_structured_doc_section_versions_insert_managers"
  ON public.company_structured_doc_section_versions;
CREATE POLICY "company_structured_doc_section_versions_insert_managers"
  ON public.company_structured_doc_section_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

GRANT SELECT, INSERT ON public.company_structured_doc_section_versions TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_structured_doc_section_versions_latest(text) TO authenticated;
