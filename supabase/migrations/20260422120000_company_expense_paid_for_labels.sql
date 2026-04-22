-- 결제 내용(paid_for) 정규화용 마스터 라벨 + 차량 정비 다대다 연결

begin;

CREATE TABLE IF NOT EXISTS public.company_expense_paid_for_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  label_ko TEXT NOT NULL,
  label_en TEXT,
  links_vehicle_maintenance BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_expense_paid_for_labels IS '회사 지출 결제 내용(paid_for) 정규화 표준 라벨';
COMMENT ON COLUMN public.company_expense_paid_for_labels.code IS '앱·API에서 안정적으로 참조하는 코드 (예: vehicle_maintenance)';
COMMENT ON COLUMN public.company_expense_paid_for_labels.links_vehicle_maintenance IS 'true이면 차량 정비 기록과 다대다 연결 UI 제공';

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS paid_for_label_id UUID REFERENCES public.company_expense_paid_for_labels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_expenses_paid_for_label_id ON public.company_expenses(paid_for_label_id);

CREATE TABLE IF NOT EXISTS public.company_expense_vehicle_maintenance_links (
  company_expense_id TEXT NOT NULL REFERENCES public.company_expenses(id) ON DELETE CASCADE,
  vehicle_maintenance_id TEXT NOT NULL REFERENCES public.vehicle_maintenance(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_expense_id, vehicle_maintenance_id)
);

COMMENT ON TABLE public.company_expense_vehicle_maintenance_links IS '회사 지출(차량 정비 라벨) ↔ vehicle_maintenance 다대다 연결';

CREATE INDEX IF NOT EXISTS idx_ce_vm_links_expense ON public.company_expense_vehicle_maintenance_links(company_expense_id);
CREATE INDEX IF NOT EXISTS idx_ce_vm_links_maintenance ON public.company_expense_vehicle_maintenance_links(vehicle_maintenance_id);

-- 기본 라벨 (코드는 영문, 표시는 한글)
INSERT INTO public.company_expense_paid_for_labels (code, label_ko, label_en, links_vehicle_maintenance, sort_order) VALUES
  ('vehicle_maintenance', '차량 정비', 'Vehicle maintenance', true, 10),
  ('fuel_parking', '연료·주차·통행', 'Fuel, parking, tolls', false, 20),
  ('meals', '식비·접대', 'Meals & entertainment', false, 30),
  ('office_supplies', '사무·소모품', 'Office & supplies', false, 40),
  ('utilities', '공과금', 'Utilities', false, 50),
  ('marketing', '마케팅·광고', 'Marketing & advertising', false, 60),
  ('software_subscription', '소프트웨어·구독', 'Software & subscriptions', false, 70),
  ('travel', '출장·여행', 'Travel', false, 80),
  ('labor', '인건비·용역', 'Labor & contractors', false, 90),
  ('insurance_fees', '보험·수수료', 'Insurance & fees', false, 100),
  ('other', '기타', 'Other', false, 999)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.company_expense_paid_for_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_expense_vehicle_maintenance_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_expense_paid_for_labels_select" ON public.company_expense_paid_for_labels;
CREATE POLICY "company_expense_paid_for_labels_select" ON public.company_expense_paid_for_labels
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "company_expense_paid_for_labels_all_staff" ON public.company_expense_paid_for_labels;
CREATE POLICY "company_expense_paid_for_labels_all_staff" ON public.company_expense_paid_for_labels
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "company_expense_vm_links_select" ON public.company_expense_vehicle_maintenance_links;
CREATE POLICY "company_expense_vm_links_select" ON public.company_expense_vehicle_maintenance_links
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "company_expense_vm_links_all_staff" ON public.company_expense_vehicle_maintenance_links;
CREATE POLICY "company_expense_vm_links_all_staff" ON public.company_expense_vehicle_maintenance_links
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.company_expense_paid_for_normalization_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'paid_for', q.paid_for,
        'count', q.cnt,
        'paid_for_label_id', q.paid_for_label_id
      )
      ORDER BY q.cnt DESC
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT ce.paid_for, COUNT(*)::int AS cnt, ce.paid_for_label_id
    FROM company_expenses ce
    WHERE ce.paid_for IS NOT NULL AND btrim(ce.paid_for::text) <> ''
    GROUP BY ce.paid_for, ce.paid_for_label_id
  ) q;
$$;

COMMENT ON FUNCTION public.company_expense_paid_for_normalization_stats() IS '결제 내용별 건수·라벨 부여 여부(정규화 UI용)';

GRANT EXECUTE ON FUNCTION public.company_expense_paid_for_normalization_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.company_expense_paid_for_normalization_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_expense_paid_for_normalization_stats() TO service_role;

commit;
