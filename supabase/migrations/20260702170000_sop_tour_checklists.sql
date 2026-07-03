-- SOP 체크 줄 ↔ 상품(투어 템플릿) 매핑 + 투어별 가이드 이행 기록

CREATE TABLE IF NOT EXISTS public.sop_product_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sop_version_id uuid NOT NULL REFERENCES public.company_sop_versions(id) ON DELETE CASCADE,
  section_id text NOT NULL,
  category_id text NOT NULL,
  item_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sop_product_checklist_items_product_item_unique UNIQUE (product_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_product_checklist_items_product
  ON public.sop_product_checklist_items (product_id);

CREATE INDEX IF NOT EXISTS idx_sop_product_checklist_items_version
  ON public.sop_product_checklist_items (sop_version_id);

COMMENT ON TABLE public.sop_product_checklist_items IS
  '상품별 SOP 체크 줄 템플릿. body_structure의 section_id/category_id/item_id 참조.';

CREATE TABLE IF NOT EXISTS public.sop_tour_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id text NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_by_email text NOT NULL,
  CONSTRAINT sop_tour_checklist_completions_tour_item_unique UNIQUE (tour_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_sop_tour_checklist_completions_tour
  ON public.sop_tour_checklist_completions (tour_id);

COMMENT ON TABLE public.sop_tour_checklist_completions IS
  '투어 실행 시 가이드가 체크한 SOP 줄 (item_id 기준).';

ALTER TABLE public.sop_product_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_tour_checklist_completions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.sop_product_checklist_items FROM anon;
REVOKE ALL ON public.sop_tour_checklist_completions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_product_checklist_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sop_tour_checklist_completions TO authenticated;

DROP POLICY IF EXISTS "sop_product_checklist_items_select_team" ON public.sop_product_checklist_items;
DROP POLICY IF EXISTS "sop_product_checklist_items_manage" ON public.sop_product_checklist_items;
DROP POLICY IF EXISTS "sop_tour_checklist_completions_select_team" ON public.sop_tour_checklist_completions;
DROP POLICY IF EXISTS "sop_tour_checklist_completions_write_team" ON public.sop_tour_checklist_completions;

CREATE POLICY "sop_product_checklist_items_select_team"
  ON public.sop_product_checklist_items FOR SELECT TO authenticated
  USING (
    public.is_team_member(public.current_email())
    OR public.is_staff(public.current_email())
  );

CREATE POLICY "sop_product_checklist_items_manage"
  ON public.sop_product_checklist_items FOR ALL TO authenticated
  USING (public.can_manage_company_sop())
  WITH CHECK (public.can_manage_company_sop());

CREATE POLICY "sop_tour_checklist_completions_select_team"
  ON public.sop_tour_checklist_completions FOR SELECT TO authenticated
  USING (
    public.is_team_member(public.current_email())
    OR public.is_staff(public.current_email())
  );

CREATE POLICY "sop_tour_checklist_completions_write_team"
  ON public.sop_tour_checklist_completions FOR ALL TO authenticated
  USING (
    public.is_team_member(public.current_email())
    OR public.is_staff(public.current_email())
  )
  WITH CHECK (
    public.is_team_member(public.current_email())
    OR public.is_staff(public.current_email())
  );
