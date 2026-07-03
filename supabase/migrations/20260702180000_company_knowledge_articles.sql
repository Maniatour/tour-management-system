-- 운영 허브: 플레이북·시스템 가이드 등 다문서 지식베이스 (SOP 규정과 분리)

CREATE TABLE IF NOT EXISTS public.company_knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title_ko text NOT NULL,
  title_en text NOT NULL,
  summary_ko text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  hub_category text NOT NULL DEFAULT 'other',
  content_type text NOT NULL DEFAULT 'playbook',
  target_roles text[] NOT NULL DEFAULT '{}',
  body_structure jsonb NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  CONSTRAINT company_knowledge_articles_slug_unique UNIQUE (slug),
  CONSTRAINT company_knowledge_articles_hub_category_chk CHECK (
    hub_category IN ('onboarding', 'reservation', 'tour_ops', 'guide', 'office', 'system', 'other')
  ),
  CONSTRAINT company_knowledge_articles_content_type_chk CHECK (
    content_type IN ('regulation', 'playbook', 'system_guide', 'reference', 'onboarding')
  )
);

CREATE INDEX IF NOT EXISTS idx_company_knowledge_articles_hub_list
  ON public.company_knowledge_articles (is_published, hub_category, sort_order, slug);

COMMENT ON TABLE public.company_knowledge_articles IS
  '운영 허브 문서(워크플로·시스템 가이드 등). SOP 규정·서명 대상과 별도.';

ALTER TABLE public.company_knowledge_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_knowledge_articles_select_staff" ON public.company_knowledge_articles;
CREATE POLICY "company_knowledge_articles_select_staff"
  ON public.company_knowledge_articles FOR SELECT TO authenticated
  USING (
    public.is_staff()
    AND (is_published = true OR public.can_manage_company_sop())
  );

DROP POLICY IF EXISTS "company_knowledge_articles_insert_managers" ON public.company_knowledge_articles;
CREATE POLICY "company_knowledge_articles_insert_managers"
  ON public.company_knowledge_articles FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_knowledge_articles_update_managers" ON public.company_knowledge_articles;
CREATE POLICY "company_knowledge_articles_update_managers"
  ON public.company_knowledge_articles FOR UPDATE TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());

DROP POLICY IF EXISTS "company_knowledge_articles_delete_managers" ON public.company_knowledge_articles;
CREATE POLICY "company_knowledge_articles_delete_managers"
  ON public.company_knowledge_articles FOR DELETE TO authenticated
  USING (public.can_manage_company_sop());

DROP TRIGGER IF EXISTS update_company_knowledge_articles_updated_at ON public.company_knowledge_articles;
CREATE TRIGGER update_company_knowledge_articles_updated_at
  BEFORE UPDATE ON public.company_knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
