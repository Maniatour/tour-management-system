-- 지출 원장 ↔ 현금 관리(cash_transactions) 출금 대조 — 은행 명세 없이 현금 지출 증빙용
BEGIN;

CREATE TABLE IF NOT EXISTS public.expense_cash_ledger_matches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  expense_source_table TEXT NOT NULL,
  expense_source_id TEXT NOT NULL,
  cash_transaction_id TEXT NOT NULL REFERENCES public.cash_transactions(id) ON DELETE CASCADE,
  matched_amount NUMERIC(14, 2),
  matched_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expense_source_table, expense_source_id, cash_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_expense_cash_ledger_matches_expense
  ON public.expense_cash_ledger_matches (expense_source_table, expense_source_id);

CREATE INDEX IF NOT EXISTS idx_expense_cash_ledger_matches_cash
  ON public.expense_cash_ledger_matches (cash_transaction_id);

COMMENT ON TABLE public.expense_cash_ledger_matches IS
  '지출 원장과 현금 관리 출금(cash_transactions) 대조. reconciliation_matches(은행·카드 명세)와 별도.';

ALTER TABLE public.expense_cash_ledger_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.expense_cash_ledger_matches FROM anon;

CREATE POLICY "expense_cash_ledger_matches_select_staff"
  ON public.expense_cash_ledger_matches FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY "expense_cash_ledger_matches_insert_staff"
  ON public.expense_cash_ledger_matches FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

CREATE POLICY "expense_cash_ledger_matches_update_staff"
  ON public.expense_cash_ledger_matches FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "expense_cash_ledger_matches_delete_staff"
  ON public.expense_cash_ledger_matches FOR DELETE TO authenticated
  USING (public.is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_cash_ledger_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_cash_ledger_matches TO service_role;

COMMIT;
