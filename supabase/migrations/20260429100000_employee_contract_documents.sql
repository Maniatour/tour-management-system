-- 직원 계약서: SOP와 동일한 버전·서명·초안·스토리지 패턴

CREATE TABLE IF NOT EXISTS public.company_employee_contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL,
  title text NOT NULL DEFAULT '직원 계약서',
  body_md text,
  body_structure jsonb,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_employee_contract_versions_version_number_positive CHECK (version_number >= 1),
  CONSTRAINT company_employee_contract_versions_version_unique UNIQUE (version_number)
);

CREATE INDEX IF NOT EXISTS idx_company_employee_contract_versions_published_at
  ON public.company_employee_contract_versions (published_at DESC);

COMMENT ON TABLE public.company_employee_contract_versions IS '직원 계약서 게시 버전(개정 시 새 행)';
COMMENT ON COLUMN public.company_employee_contract_versions.body_structure IS '계약서 본문 계층(JSON, SOP body_structure와 동일 스키마)';

CREATE TABLE IF NOT EXISTS public.employee_contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.company_employee_contract_versions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  signer_email text NOT NULL,
  signer_name text NOT NULL,
  pdf_storage_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_contract_signatures_version_user_unique UNIQUE (version_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_contract_signatures_version_id ON public.employee_contract_signatures (version_id);
CREATE INDEX IF NOT EXISTS idx_employee_contract_signatures_user_id ON public.employee_contract_signatures (user_id);
CREATE INDEX IF NOT EXISTS idx_employee_contract_signatures_signer_email_lower ON public.employee_contract_signatures (lower(signer_email));

CREATE TABLE IF NOT EXISTS public.company_employee_contract_draft (
  singleton smallint PRIMARY KEY CHECK (singleton = 1),
  body_structure jsonb NOT NULL,
  paste_raw text NOT NULL DEFAULT '',
  edit_locale text NOT NULL DEFAULT 'ko',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_employee_contract_draft_edit_locale_chk CHECK (edit_locale IN ('ko', 'en'))
);

COMMENT ON TABLE public.company_employee_contract_draft IS '직원 계약서 편집 초안 1건(게시 및 알림 전까지 보관)';
COMMENT ON TABLE public.employee_contract_signatures IS '직원별 계약서 버전 서명 및 PDF 저장 경로';

ALTER TABLE public.company_employee_contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_employee_contract_draft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_employee_contract_versions_select_staff" ON public.company_employee_contract_versions;
CREATE POLICY "company_employee_contract_versions_select_staff"
  ON public.company_employee_contract_versions FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "company_employee_contract_versions_insert_managers" ON public.company_employee_contract_versions;
CREATE POLICY "company_employee_contract_versions_insert_managers"
  ON public.company_employee_contract_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "employee_contract_signatures_select_staff" ON public.employee_contract_signatures;
CREATE POLICY "employee_contract_signatures_select_staff"
  ON public.employee_contract_signatures FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND (
      user_id = auth.uid()
      OR public.can_manage_company_sop()
    )
  );

DROP POLICY IF EXISTS "employee_contract_signatures_insert_own" ON public.employee_contract_signatures;
CREATE POLICY "employee_contract_signatures_insert_own"
  ON public.employee_contract_signatures FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "company_employee_contract_draft_select_managers" ON public.company_employee_contract_draft;
CREATE POLICY "company_employee_contract_draft_select_managers"
  ON public.company_employee_contract_draft FOR SELECT TO authenticated
  USING (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_employee_contract_draft_insert_managers" ON public.company_employee_contract_draft;
CREATE POLICY "company_employee_contract_draft_insert_managers"
  ON public.company_employee_contract_draft FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_employee_contract_draft_update_managers" ON public.company_employee_contract_draft;
CREATE POLICY "company_employee_contract_draft_update_managers"
  ON public.company_employee_contract_draft FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());

DROP TRIGGER IF EXISTS update_company_employee_contract_draft_updated_at ON public.company_employee_contract_draft;
CREATE TRIGGER update_company_employee_contract_draft_updated_at
  BEFORE UPDATE ON public.company_employee_contract_draft
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'employee-contract-signatures',
  'employee-contract-signatures',
  false,
  15728640,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "employee_contract_signatures_storage_insert_own" ON storage.objects;
CREATE POLICY "employee_contract_signatures_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-contract-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "employee_contract_signatures_storage_select_own_or_manager" ON storage.objects;
CREATE POLICY "employee_contract_signatures_storage_select_own_or_manager"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-contract-signatures'
    AND public.is_staff()
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_company_sop()
    )
  );

DROP POLICY IF EXISTS "employee_contract_signatures_storage_update_own" ON storage.objects;
CREATE POLICY "employee_contract_signatures_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-contract-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'employee-contract-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
