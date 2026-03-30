-- Financial accounts, bank/CC statements, reconciliation, optional journal entries
-- Migration: 20260327120000_financial_reconciliation_ledger.sql

begin;

-- 1) Chart of accounts / registers (bank & card registers)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'credit_card', 'clearing', 'other')),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_type ON public.financial_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_financial_accounts_active ON public.financial_accounts(is_active);

COMMENT ON TABLE public.financial_accounts IS '은행/카드 등 금융 레지스터(명세 대조 단위)';

-- Link existing staff cards to a financial register
ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payment_methods_financial_account_id ON public.payment_methods(financial_account_id);

-- 2) Statement uploads (per account & period)
CREATE TABLE IF NOT EXISTS public.statement_imports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  financial_account_id TEXT NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  period_label TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  file_url TEXT,
  original_filename TEXT,
  status TEXT NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'reconciling', 'reconciled', 'locked')),
  imported_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_statement_imports_account ON public.statement_imports(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_statement_imports_period ON public.statement_imports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_statement_imports_status ON public.statement_imports(status);

-- 3) Parsed statement lines
CREATE TABLE IF NOT EXISTS public.statement_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_import_id TEXT NOT NULL REFERENCES public.statement_imports(id) ON DELETE CASCADE,
  posted_date DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  direction TEXT NOT NULL CHECK (direction IN ('outflow', 'inflow')),
  description TEXT,
  merchant TEXT,
  external_reference TEXT,
  dedupe_key TEXT NOT NULL,
  raw JSONB,
  matched_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (matched_status IN ('unmatched', 'partial', 'matched')),
  exclude_from_pnl BOOLEAN NOT NULL DEFAULT false,
  is_personal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (statement_import_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_statement_lines_import ON public.statement_lines(statement_import_id);
CREATE INDEX IF NOT EXISTS idx_statement_lines_posted_date ON public.statement_lines(posted_date);
CREATE INDEX IF NOT EXISTS idx_statement_lines_matched ON public.statement_lines(matched_status);

-- 4) Links statement lines to operational expense rows
CREATE TABLE IF NOT EXISTS public.reconciliation_matches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  statement_line_id TEXT NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  matched_amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (statement_line_id, source_table, source_id)
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_line ON public.reconciliation_matches(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_matches_source ON public.reconciliation_matches(source_table, source_id);

-- 5) Company expenses: ledger flags & statement adjustment link
ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS ledger_expense_origin TEXT NOT NULL DEFAULT 'operational'
    CHECK (ledger_expense_origin IN ('operational', 'statement_adjustment'));

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS statement_line_id TEXT REFERENCES public.statement_lines(id) ON DELETE SET NULL;

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS exclude_from_pnl BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT CHECK (reconciliation_status IS NULL OR reconciliation_status IN ('draft', 'reconciled'));

CREATE INDEX IF NOT EXISTS idx_company_expenses_statement_line ON public.company_expenses(statement_line_id);
CREATE INDEX IF NOT EXISTS idx_company_expenses_ledger_origin ON public.company_expenses(ledger_expense_origin);

-- Tour / reservation: PNL exclusion flags (optional personal / non-business)
ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS exclude_from_pnl BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS exclude_from_pnl BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

-- 6) Optional double-entry (card payment transfers, adjustments)
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entry_date DATE NOT NULL,
  memo TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'card_payment_transfer', 'period_close', 'statement')),
  statement_import_id TEXT REFERENCES public.statement_imports(id) ON DELETE SET NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  journal_entry_id TEXT NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  financial_account_id TEXT NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  line_memo TEXT,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(financial_account_id);

-- RLS (align with existing expense tables: open read, staff write)
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_accounts' AND policyname = 'financial_accounts_select_all') THEN
    CREATE POLICY "financial_accounts_select_all" ON public.financial_accounts FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_accounts' AND policyname = 'financial_accounts_insert_staff') THEN
    CREATE POLICY "financial_accounts_insert_staff" ON public.financial_accounts FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_accounts' AND policyname = 'financial_accounts_update_staff') THEN
    CREATE POLICY "financial_accounts_update_staff" ON public.financial_accounts FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'financial_accounts' AND policyname = 'financial_accounts_delete_staff') THEN
    CREATE POLICY "financial_accounts_delete_staff" ON public.financial_accounts FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_imports' AND policyname = 'statement_imports_select_all') THEN
    CREATE POLICY "statement_imports_select_all" ON public.statement_imports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_imports' AND policyname = 'statement_imports_insert_staff') THEN
    CREATE POLICY "statement_imports_insert_staff" ON public.statement_imports FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_imports' AND policyname = 'statement_imports_update_staff') THEN
    CREATE POLICY "statement_imports_update_staff" ON public.statement_imports FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_imports' AND policyname = 'statement_imports_delete_staff') THEN
    CREATE POLICY "statement_imports_delete_staff" ON public.statement_imports FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_lines' AND policyname = 'statement_lines_select_all') THEN
    CREATE POLICY "statement_lines_select_all" ON public.statement_lines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_lines' AND policyname = 'statement_lines_insert_staff') THEN
    CREATE POLICY "statement_lines_insert_staff" ON public.statement_lines FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_lines' AND policyname = 'statement_lines_update_staff') THEN
    CREATE POLICY "statement_lines_update_staff" ON public.statement_lines FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_lines' AND policyname = 'statement_lines_delete_staff') THEN
    CREATE POLICY "statement_lines_delete_staff" ON public.statement_lines FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliation_matches' AND policyname = 'reconciliation_matches_select_all') THEN
    CREATE POLICY "reconciliation_matches_select_all" ON public.reconciliation_matches FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliation_matches' AND policyname = 'reconciliation_matches_insert_staff') THEN
    CREATE POLICY "reconciliation_matches_insert_staff" ON public.reconciliation_matches FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliation_matches' AND policyname = 'reconciliation_matches_update_staff') THEN
    CREATE POLICY "reconciliation_matches_update_staff" ON public.reconciliation_matches FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'reconciliation_matches' AND policyname = 'reconciliation_matches_delete_staff') THEN
    CREATE POLICY "reconciliation_matches_delete_staff" ON public.reconciliation_matches FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_select_all') THEN
    CREATE POLICY "journal_entries_select_all" ON public.journal_entries FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_insert_staff') THEN
    CREATE POLICY "journal_entries_insert_staff" ON public.journal_entries FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_update_staff') THEN
    CREATE POLICY "journal_entries_update_staff" ON public.journal_entries FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_entries' AND policyname = 'journal_entries_delete_staff') THEN
    CREATE POLICY "journal_entries_delete_staff" ON public.journal_entries FOR DELETE USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_lines' AND policyname = 'journal_lines_select_all') THEN
    CREATE POLICY "journal_lines_select_all" ON public.journal_lines FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_lines' AND policyname = 'journal_lines_insert_staff') THEN
    CREATE POLICY "journal_lines_insert_staff" ON public.journal_lines FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_lines' AND policyname = 'journal_lines_update_staff') THEN
    CREATE POLICY "journal_lines_update_staff" ON public.journal_lines FOR UPDATE USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journal_lines' AND policyname = 'journal_lines_delete_staff') THEN
    CREATE POLICY "journal_lines_delete_staff" ON public.journal_lines FOR DELETE USING (true);
  END IF;
END $$;

-- Triggers: updated_at
CREATE OR REPLACE FUNCTION public.touch_financial_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financial_accounts_updated ON public.financial_accounts;
CREATE TRIGGER trg_financial_accounts_updated
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_financial_accounts_updated_at();

CREATE OR REPLACE FUNCTION public.touch_statement_imports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_statement_imports_updated ON public.statement_imports;
CREATE TRIGGER trg_statement_imports_updated
  BEFORE UPDATE ON public.statement_imports
  FOR EACH ROW EXECUTE FUNCTION public.touch_statement_imports_updated_at();

CREATE OR REPLACE FUNCTION public.touch_statement_lines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_statement_lines_updated ON public.statement_lines;
CREATE TRIGGER trg_statement_lines_updated
  BEFORE UPDATE ON public.statement_lines
  FOR EACH ROW EXECUTE FUNCTION public.touch_statement_lines_updated_at();

-- Default fiscal settings for PNL / cash reports (2025 base)
INSERT INTO public.shared_settings (setting_key, setting_value)
VALUES ('fiscal_reporting', '{"ledgerBaseDate":"2025-01-01"}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;

commit;
