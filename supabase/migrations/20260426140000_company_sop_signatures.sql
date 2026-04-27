-- 회사 SOP 버전, 직원 서명(PDF 경로), 직원용 웹푸시 구독

CREATE OR REPLACE FUNCTION public.can_manage_company_sop()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team
    WHERE lower(trim(email)) = public.current_email()
      AND is_active = true
      AND lower(trim(coalesce(position, ''))) IN ('super', 'op', 'office manager')
  )
  OR public.current_email() IN ('info@maniatour.com', 'wooyong.shim09@gmail.com');
$$;

CREATE TABLE IF NOT EXISTS public.company_sop_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_number integer NOT NULL,
  title text NOT NULL DEFAULT '회사 표준운영절차 (SOP)',
  body_md text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_sop_versions_version_number_positive CHECK (version_number >= 1),
  CONSTRAINT company_sop_versions_version_unique UNIQUE (version_number)
);

CREATE INDEX IF NOT EXISTS idx_company_sop_versions_published_at
  ON public.company_sop_versions (published_at DESC);

CREATE TABLE IF NOT EXISTS public.sop_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.company_sop_versions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  signer_email text NOT NULL,
  signer_name text NOT NULL,
  pdf_storage_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sop_signatures_version_user_unique UNIQUE (version_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_signatures_version_id ON public.sop_signatures (version_id);
CREATE INDEX IF NOT EXISTS idx_sop_signatures_user_id ON public.sop_signatures (user_id);
CREATE INDEX IF NOT EXISTS idx_sop_signatures_signer_email_lower ON public.sop_signatures (lower(signer_email));

CREATE TABLE IF NOT EXISTS public.staff_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  user_email text NOT NULL,
  endpoint text NOT NULL,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  language text NOT NULL DEFAULT 'ko',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_push_subscriptions_endpoint_unique UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_staff_push_subscriptions_user_id ON public.staff_push_subscriptions (user_id);

DROP TRIGGER IF EXISTS update_staff_push_subscriptions_updated_at ON public.staff_push_subscriptions;
CREATE TRIGGER update_staff_push_subscriptions_updated_at
  BEFORE UPDATE ON public.staff_push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.company_sop_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_sop_versions_select_staff" ON public.company_sop_versions;
CREATE POLICY "company_sop_versions_select_staff"
  ON public.company_sop_versions FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "company_sop_versions_insert_managers" ON public.company_sop_versions;
CREATE POLICY "company_sop_versions_insert_managers"
  ON public.company_sop_versions FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "sop_signatures_select_staff" ON public.sop_signatures;
CREATE POLICY "sop_signatures_select_staff"
  ON public.sop_signatures FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND (
      user_id = auth.uid()
      OR public.can_manage_company_sop()
    )
  );

DROP POLICY IF EXISTS "sop_signatures_insert_own" ON public.sop_signatures;
CREATE POLICY "sop_signatures_insert_own"
  ON public.sop_signatures FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "staff_push_subscriptions_select_own" ON public.staff_push_subscriptions;
CREATE POLICY "staff_push_subscriptions_select_own"
  ON public.staff_push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "staff_push_subscriptions_insert_own" ON public.staff_push_subscriptions;
CREATE POLICY "staff_push_subscriptions_insert_own"
  ON public.staff_push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff()
    AND user_id = auth.uid()
    AND lower(trim(user_email)) = public.current_email()
  );

DROP POLICY IF EXISTS "staff_push_subscriptions_update_own" ON public.staff_push_subscriptions;
CREATE POLICY "staff_push_subscriptions_update_own"
  ON public.staff_push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND lower(trim(user_email)) = public.current_email()
  );

DROP POLICY IF EXISTS "staff_push_subscriptions_delete_own" ON public.staff_push_subscriptions;
CREATE POLICY "staff_push_subscriptions_delete_own"
  ON public.staff_push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sop-signatures',
  'sop-signatures',
  false,
  15728640,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "sop_signatures_storage_insert_own" ON storage.objects;
CREATE POLICY "sop_signatures_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sop-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "sop_signatures_storage_select_own_or_manager" ON storage.objects;
CREATE POLICY "sop_signatures_storage_select_own_or_manager"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'sop-signatures'
    AND public.is_staff()
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.can_manage_company_sop()
    )
  );

DROP POLICY IF EXISTS "sop_signatures_storage_update_own" ON storage.objects;
CREATE POLICY "sop_signatures_storage_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sop-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'sop-signatures'
    AND public.is_staff()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON TABLE public.company_sop_versions IS '회사 SOP 게시 버전(개정 시 새 행)';
COMMENT ON TABLE public.sop_signatures IS '직원별 SOP 버전 서명 및 PDF 저장 경로';
COMMENT ON TABLE public.staff_push_subscriptions IS 'SOP 등 사내 알림용 웹푸시 구독(직원)';
