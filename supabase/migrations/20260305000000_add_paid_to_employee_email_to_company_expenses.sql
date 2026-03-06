-- company_expenses: paid_to와 별개로 실제 수급 직원 이메일을 기록해 정규화할 수 있도록 컬럼 추가
-- Migration: 20260305000000_add_paid_to_employee_email_to_company_expenses.sql

begin;

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS paid_to_employee_email VARCHAR(255) NULL;

COMMENT ON COLUMN public.company_expenses.paid_to_employee_email IS '실제 수급 직원 이메일(team.email). paid_to는 표시용 이름, 이 컬럼으로 직원 매칭/정규화';

CREATE INDEX IF NOT EXISTS idx_company_expenses_paid_to_employee_email
  ON public.company_expenses(paid_to_employee_email);

commit;
