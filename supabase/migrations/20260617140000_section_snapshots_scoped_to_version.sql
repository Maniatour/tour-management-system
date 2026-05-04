-- 섹션 스냅샷을 게시 버전(company_sop_versions / company_employee_contract_versions 의 id)별로 분리

ALTER TABLE public.company_structured_doc_section_versions
  ADD COLUMN IF NOT EXISTS published_document_version_id uuid;

COMMENT ON COLUMN public.company_structured_doc_section_versions.published_document_version_id IS
  '해당 스냅샷이 속한 게시 버전 행 id (SOP·계약서 테이블 공통 uuid). NULL = 마이그레이션 이전 전역 이력';

ALTER TABLE public.company_structured_doc_section_versions
  DROP CONSTRAINT IF EXISTS company_structured_doc_section_versions_unique_rev;

ALTER TABLE public.company_structured_doc_section_versions
  ADD CONSTRAINT company_structured_doc_section_versions_unique_rev
  UNIQUE (doc_kind, published_document_version_id, section_id, revision);

CREATE OR REPLACE FUNCTION public.company_structured_doc_section_versions_set_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(MAX(revision), 0) + 1 INTO NEW.revision
  FROM public.company_structured_doc_section_versions
  WHERE doc_kind = NEW.doc_kind
    AND section_id = NEW.section_id
    AND published_document_version_id IS NOT DISTINCT FROM NEW.published_document_version_id;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.company_structured_doc_section_versions_latest(text);

CREATE OR REPLACE FUNCTION public.company_structured_doc_section_versions_latest(
  p_doc_kind text,
  p_published_document_version_id uuid
)
RETURNS SETOF public.company_structured_doc_section_versions
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT DISTINCT ON (v.section_id) v.*
  FROM public.company_structured_doc_section_versions v
  WHERE v.doc_kind = p_doc_kind
    AND v.published_document_version_id IS NOT DISTINCT FROM p_published_document_version_id
  ORDER BY v.section_id, v.revision DESC, v.created_at DESC;
$$;

COMMENT ON FUNCTION public.company_structured_doc_section_versions_latest(text, uuid) IS
  'doc_kind + 게시 버전 id 기준, 섹션당 최신 revision 한 행';

GRANT EXECUTE ON FUNCTION public.company_structured_doc_section_versions_latest(text, uuid) TO authenticated;
