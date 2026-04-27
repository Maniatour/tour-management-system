-- SOP 편집 초안: 게시·푸시 없이 서버에만 보관 (단일 행)

CREATE TABLE IF NOT EXISTS public.company_sop_draft (
  singleton smallint PRIMARY KEY CHECK (singleton = 1),
  body_structure jsonb NOT NULL,
  paste_raw text NOT NULL DEFAULT '',
  edit_locale text NOT NULL DEFAULT 'ko',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_sop_draft_edit_locale_chk CHECK (edit_locale IN ('ko', 'en'))
);

COMMENT ON TABLE public.company_sop_draft IS '회사 SOP 편집 초안 1건(게시 및 알림 전까지 보관)';

ALTER TABLE public.company_sop_draft ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_sop_draft_select_managers" ON public.company_sop_draft;
CREATE POLICY "company_sop_draft_select_managers"
  ON public.company_sop_draft FOR SELECT TO authenticated
  USING (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_sop_draft_insert_managers" ON public.company_sop_draft;
CREATE POLICY "company_sop_draft_insert_managers"
  ON public.company_sop_draft FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_sop_draft_update_managers" ON public.company_sop_draft;
CREATE POLICY "company_sop_draft_update_managers"
  ON public.company_sop_draft FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());

DROP TRIGGER IF EXISTS update_company_sop_draft_updated_at ON public.company_sop_draft;
CREATE TRIGGER update_company_sop_draft_updated_at
  BEFORE UPDATE ON public.company_sop_draft
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
