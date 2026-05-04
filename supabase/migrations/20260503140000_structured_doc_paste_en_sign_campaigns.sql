-- 한/영 붙여넣기 분리 + 관리자 발송 서명 요청(캠페인) + PDF 보관

ALTER TABLE public.company_sop_draft
  ADD COLUMN IF NOT EXISTS paste_raw_en text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.company_sop_draft.paste_raw_en IS '텍스트 붙여넣기(영문) 원문 — 구조 변환 시 영문 필드에 반영';

ALTER TABLE public.company_employee_contract_draft
  ADD COLUMN IF NOT EXISTS paste_raw_en text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.company_employee_contract_draft.paste_raw_en IS '텍스트 붙여넣기(영문) 원문';

CREATE TABLE IF NOT EXISTS public.company_structured_doc_sign_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_kind text NOT NULL CHECK (doc_kind IN ('sop', 'employee_contract')),
  body_structure jsonb NOT NULL,
  title text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_structured_doc_sign_campaigns_created
  ON public.company_structured_doc_sign_campaigns (created_at DESC);

COMMENT ON TABLE public.company_structured_doc_sign_campaigns IS 'SOP·계약서 초안에 대한 팀원 서명 요청(발송 단위)';

CREATE TABLE IF NOT EXISTS public.company_structured_doc_sign_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.company_structured_doc_sign_campaigns (id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed')),
  CONSTRAINT company_structured_doc_sign_campaign_recipients_unique UNIQUE (campaign_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_sign_campaign_recipients_email_status
  ON public.company_structured_doc_sign_campaign_recipients (lower(recipient_email), status);

COMMENT ON TABLE public.company_structured_doc_sign_campaign_recipients IS '캠페인별 수신자(이메일). 서명 완료 시 status=signed';

CREATE TABLE IF NOT EXISTS public.company_structured_doc_campaign_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.company_structured_doc_sign_campaigns (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  signer_email text NOT NULL,
  signer_name text NOT NULL,
  pdf_storage_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_structured_doc_campaign_signatures_unique UNIQUE (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_structured_doc_campaign_sigs_campaign
  ON public.company_structured_doc_campaign_signatures (campaign_id);

COMMENT ON TABLE public.company_structured_doc_campaign_signatures IS '캠페인 서명 PDF 경로 — 수신자·관리자 동일 파일 조회';

ALTER TABLE public.company_structured_doc_sign_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_structured_doc_sign_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_structured_doc_campaign_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "structured_doc_sign_campaigns_select_managers"
  ON public.company_structured_doc_sign_campaigns;
DROP POLICY IF EXISTS "structured_doc_sign_campaigns_select_recipient"
  ON public.company_structured_doc_sign_campaigns;

CREATE POLICY "structured_doc_sign_campaigns_select_managers"
  ON public.company_structured_doc_sign_campaigns FOR SELECT TO authenticated
  USING (public.can_manage_company_sop());

CREATE POLICY "structured_doc_sign_campaigns_select_recipient"
  ON public.company_structured_doc_sign_campaigns FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_structured_doc_sign_campaign_recipients r
      WHERE r.campaign_id = company_structured_doc_sign_campaigns.id
        AND lower(trim(r.recipient_email)) = lower(trim(auth.jwt() ->> 'email'))
    )
  );

DROP POLICY IF EXISTS "structured_doc_sign_campaigns_insert_managers"
  ON public.company_structured_doc_sign_campaigns;
CREATE POLICY "structured_doc_sign_campaigns_insert_managers"
  ON public.company_structured_doc_sign_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "structured_doc_sign_campaign_recipients_select"
  ON public.company_structured_doc_sign_campaign_recipients;
CREATE POLICY "structured_doc_sign_campaign_recipients_select"
  ON public.company_structured_doc_sign_campaign_recipients FOR SELECT TO authenticated
  USING (
    public.can_manage_company_sop()
    OR lower(trim(recipient_email)) = lower(trim(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "structured_doc_sign_campaign_recipients_insert_managers"
  ON public.company_structured_doc_sign_campaign_recipients;
CREATE POLICY "structured_doc_sign_campaign_recipients_insert_managers"
  ON public.company_structured_doc_sign_campaign_recipients FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "structured_doc_sign_campaign_recipients_update_own"
  ON public.company_structured_doc_sign_campaign_recipients;
CREATE POLICY "structured_doc_sign_campaign_recipients_update_own"
  ON public.company_structured_doc_sign_campaign_recipients FOR UPDATE TO authenticated
  USING (
    public.can_manage_company_sop()
    OR lower(trim(recipient_email)) = lower(trim(auth.jwt() ->> 'email'))
  )
  WITH CHECK (
    public.can_manage_company_sop()
    OR lower(trim(recipient_email)) = lower(trim(auth.jwt() ->> 'email'))
  );

DROP POLICY IF EXISTS "structured_doc_campaign_signatures_select"
  ON public.company_structured_doc_campaign_signatures;
CREATE POLICY "structured_doc_campaign_signatures_select"
  ON public.company_structured_doc_campaign_signatures FOR SELECT TO authenticated
  USING (public.can_manage_company_sop() OR user_id = auth.uid());

DROP POLICY IF EXISTS "structured_doc_campaign_signatures_insert_own"
  ON public.company_structured_doc_campaign_signatures;
CREATE POLICY "structured_doc_campaign_signatures_insert_own"
  ON public.company_structured_doc_campaign_signatures FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'structured-doc-campaign-signatures',
  'structured-doc-campaign-signatures',
  false,
  15728640,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "structured_doc_campaign_sigs_storage_insert_own"
  ON storage.objects;
CREATE POLICY "structured_doc_campaign_sigs_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'structured-doc-campaign-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "structured_doc_campaign_sigs_storage_select_own_or_manager"
  ON storage.objects;
CREATE POLICY "structured_doc_campaign_sigs_storage_select_own_or_manager"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'structured-doc-campaign-signatures'
    AND public.is_staff()
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_company_sop()
    )
  );

DROP POLICY IF EXISTS "structured_doc_campaign_sigs_storage_update_own"
  ON storage.objects;
CREATE POLICY "structured_doc_campaign_sigs_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'structured-doc-campaign-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'structured-doc-campaign-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
