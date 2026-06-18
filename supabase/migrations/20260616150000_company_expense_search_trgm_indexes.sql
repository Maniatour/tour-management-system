-- 회사 지출 관리 검색 (`src/lib/companyExpenseSearch.ts`, `/api/company-expenses`)
-- ILIKE '%…%' 및 금액 부분 일치용 인덱스.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm;
  END IF;
END $$;

-- 금액 부분 검색: JS 1만 행 스캔 대신 abs(amount)::text ilike
ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS amount_abs_text text
  GENERATED ALWAYS AS (
    CASE WHEN amount IS NULL THEN NULL ELSE abs(amount)::text END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_paid_to
  ON public.company_expenses USING gin (paid_to gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_paid_for
  ON public.company_expenses USING gin (paid_for gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_description
  ON public.company_expenses USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_notes
  ON public.company_expenses USING gin (notes gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_category
  ON public.company_expenses USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_subcategory
  ON public.company_expenses USING gin (subcategory gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_standard_paid_for
  ON public.company_expenses USING gin (standard_paid_for gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_submit_by
  ON public.company_expenses USING gin (submit_by gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_expenses_trgm_amount_abs_text
  ON public.company_expenses USING gin (amount_abs_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_payment_methods_trgm_method
  ON public.payment_methods USING gin (method gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_payment_methods_trgm_display_name
  ON public.payment_methods USING gin (display_name gin_trgm_ops);
