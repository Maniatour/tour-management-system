-- 투어·예약 지출: 가이드/직원 개인카드 등 선결제 후 회사 환급(Reimburse) 추적

ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursed_on DATE NULL,
  ADD COLUMN IF NOT EXISTS reimbursement_note TEXT NULL;

COMMENT ON COLUMN public.tour_expenses.reimbursed_amount IS '회사가 직원에게 환급한 누적 금액 (지출 금액 이하)';
COMMENT ON COLUMN public.tour_expenses.reimbursed_on IS '마지막 환급일 (대표)';
COMMENT ON COLUMN public.tour_expenses.reimbursement_note IS '환급 관련 메모 (송금 수단, 회차 등)';

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS reimbursed_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reimbursed_on DATE NULL,
  ADD COLUMN IF NOT EXISTS reimbursement_note TEXT NULL;

COMMENT ON COLUMN public.reservation_expenses.reimbursed_amount IS '회사가 직원에게 환급한 누적 금액 (지출 금액 이하)';
COMMENT ON COLUMN public.reservation_expenses.reimbursed_on IS '마지막 환급일 (대표)';
COMMENT ON COLUMN public.reservation_expenses.reimbursement_note IS '환급 관련 메모 (송금 수단, 회차 등)';

ALTER TABLE public.tour_expenses
  DROP CONSTRAINT IF EXISTS tour_expenses_reimbursed_amount_non_negative;
ALTER TABLE public.tour_expenses
  ADD CONSTRAINT tour_expenses_reimbursed_amount_non_negative CHECK (reimbursed_amount >= 0);

ALTER TABLE public.reservation_expenses
  DROP CONSTRAINT IF EXISTS reservation_expenses_reimbursed_amount_non_negative;
ALTER TABLE public.reservation_expenses
  ADD CONSTRAINT reservation_expenses_reimbursed_amount_non_negative CHECK (reimbursed_amount >= 0);
