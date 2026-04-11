-- 일부 환경에서 invoices가 초기 마이그레이션 없이 생성되어 컬럼이 누락된 경우 보정
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS discount_reason TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS due_date DATE;
