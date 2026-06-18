-- 명세·현금 대조 불필요 표시 (현금 관리에 노출되는 타 테이블 지출 등)
BEGIN;

CREATE TABLE IF NOT EXISTS public.expense_reconciliation_exemptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  note TEXT,
  exempt_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_reconciliation_exemptions_source
  ON public.expense_reconciliation_exemptions (source_table, source_id);

COMMENT ON TABLE public.expense_reconciliation_exemptions IS
  '은행 명세·현금 출금 대조가 필요 없는 원장 행. reconciliation_matches·expense_cash_ledger_matches와 별도.';

ALTER TABLE public.expense_reconciliation_exemptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.expense_reconciliation_exemptions FROM anon;

CREATE POLICY "expense_reconciliation_exemptions_select_staff"
  ON public.expense_reconciliation_exemptions FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "expense_reconciliation_exemptions_insert_staff"
  ON public.expense_reconciliation_exemptions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "expense_reconciliation_exemptions_update_staff"
  ON public.expense_reconciliation_exemptions FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "expense_reconciliation_exemptions_delete_staff"
  ON public.expense_reconciliation_exemptions FOR DELETE TO authenticated
  USING (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reconciliation_exemptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_reconciliation_exemptions TO service_role;

-- 명세 미대조 뷰: 대조 면제 행 제외
CREATE OR REPLACE VIEW public.company_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT ce.*
FROM public.company_expenses ce
WHERE ce.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.reconciliation_matches rm
    WHERE rm.source_table = 'company_expenses'
      AND rm.source_id = ce.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.expense_reconciliation_exemptions ere
    WHERE ere.source_table = 'company_expenses'
      AND ere.source_id = ce.id
  );

CREATE OR REPLACE VIEW public.reservation_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT re.*
FROM public.reservation_expenses re
WHERE re.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.reconciliation_matches rm
    WHERE rm.source_table = 'reservation_expenses'
      AND rm.source_id = re.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.expense_reconciliation_exemptions ere
    WHERE ere.source_table = 'reservation_expenses'
      AND ere.source_id = re.id
  );

CREATE OR REPLACE VIEW public.tour_expenses_no_statement_match
WITH (security_invoker = true) AS
SELECT te.*
FROM public.tour_expenses te
WHERE te.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.reconciliation_matches rm
    WHERE rm.source_table = 'tour_expenses'
      AND rm.source_id = te.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.expense_reconciliation_exemptions ere
    WHERE ere.source_table = 'tour_expenses'
      AND ere.source_id = te.id
  );

COMMIT;
