-- 회사 지출: 직원 개인 부담 후 환급 추적 + 목록 필터용 미환급 잔액(생성 컬럼)

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursed_on DATE NULL,
  ADD COLUMN IF NOT EXISTS reimbursement_note TEXT NULL;

COMMENT ON COLUMN public.company_expenses.reimbursed_amount IS '회사가 직원에게 환급한 누적 금액 (지출 금액 이하)';
COMMENT ON COLUMN public.company_expenses.reimbursed_on IS '마지막 환급일 (대표)';
COMMENT ON COLUMN public.company_expenses.reimbursement_note IS '환급 관련 메모';

ALTER TABLE public.company_expenses
  DROP CONSTRAINT IF EXISTS company_expenses_reimbursed_amount_non_negative;
ALTER TABLE public.company_expenses
  ADD CONSTRAINT company_expenses_reimbursed_amount_non_negative CHECK (reimbursed_amount >= 0);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'company_expenses'
      AND column_name = 'reimbursement_outstanding'
  ) THEN
    ALTER TABLE public.company_expenses
      ADD COLUMN reimbursement_outstanding NUMERIC(14, 2)
      GENERATED ALWAYS AS (
        GREATEST(
          0::numeric,
          COALESCE(amount, 0::numeric) - COALESCE(reimbursed_amount, 0::numeric)
        )
      ) STORED;
    COMMENT ON COLUMN public.company_expenses.reimbursement_outstanding IS '미환급 잔액 (생성 컬럼). 목록 필터·색인용';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_company_expenses_reimbursement_outstanding
  ON public.company_expenses (reimbursement_outstanding)
  WHERE reimbursement_outstanding > 0.01;
