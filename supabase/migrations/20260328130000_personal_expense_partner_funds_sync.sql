-- 개인 지출(is_personal + personal_partner) → partner_fund_transactions 자동 반영
-- Migration: 20260328130000_personal_expense_partner_funds_sync.sql

begin;

-- 명세/지출: 어떤 파트너 개인 사용인지
ALTER TABLE public.statement_lines ADD COLUMN IF NOT EXISTS personal_partner VARCHAR(20);
ALTER TABLE public.statement_lines DROP CONSTRAINT IF EXISTS statement_lines_personal_partner_check;
ALTER TABLE public.statement_lines ADD CONSTRAINT statement_lines_personal_partner_check
  CHECK (personal_partner IS NULL OR personal_partner IN ('partner1', 'partner2', 'erica'));

ALTER TABLE public.company_expenses ADD COLUMN IF NOT EXISTS personal_partner VARCHAR(20);
ALTER TABLE public.company_expenses DROP CONSTRAINT IF EXISTS company_expenses_personal_partner_check;
ALTER TABLE public.company_expenses ADD CONSTRAINT company_expenses_personal_partner_check
  CHECK (personal_partner IS NULL OR personal_partner IN ('partner1', 'partner2', 'erica'));

ALTER TABLE public.tour_expenses ADD COLUMN IF NOT EXISTS personal_partner VARCHAR(20);
ALTER TABLE public.tour_expenses DROP CONSTRAINT IF EXISTS tour_expenses_personal_partner_check;
ALTER TABLE public.tour_expenses ADD CONSTRAINT tour_expenses_personal_partner_check
  CHECK (personal_partner IS NULL OR personal_partner IN ('partner1', 'partner2', 'erica'));

ALTER TABLE public.reservation_expenses ADD COLUMN IF NOT EXISTS personal_partner VARCHAR(20);
ALTER TABLE public.reservation_expenses DROP CONSTRAINT IF EXISTS reservation_expenses_personal_partner_check;
ALTER TABLE public.reservation_expenses ADD CONSTRAINT reservation_expenses_personal_partner_check
  CHECK (personal_partner IS NULL OR personal_partner IN ('partner1', 'partner2', 'erica'));

CREATE INDEX IF NOT EXISTS idx_statement_lines_personal_partner ON public.statement_lines(personal_partner)
  WHERE personal_partner IS NOT NULL;

-- 파트너 자금: 수동 입력과 구분 (동기화된 행만 값 존재)
ALTER TABLE public.partner_fund_transactions
  ADD COLUMN IF NOT EXISTS external_source_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_fund_transactions_external_source_key
  ON public.partner_fund_transactions(external_source_key)
  WHERE external_source_key IS NOT NULL;

COMMENT ON COLUMN public.partner_fund_transactions.external_source_key IS '동기화 출처 키 (예: statement_lines:<id>). 수동 입력은 NULL.';

-- ---------------------------------------------------------------------------
-- Triggers: SECURITY DEFINER로 RLS 우회하여 동기 행 삽입
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_partner_funds_from_statement_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ek TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.partner_fund_transactions
    WHERE external_source_key = 'statement_lines:' || OLD.id;
    RETURN OLD;
  END IF;

  ek := 'statement_lines:' || NEW.id;
  DELETE FROM public.partner_fund_transactions WHERE external_source_key = ek;

  IF NEW.is_personal IS TRUE
     AND NEW.personal_partner IS NOT NULL
     AND NEW.direction = 'outflow'
     AND COALESCE(NEW.amount, 0) > 0 THEN
    INSERT INTO public.partner_fund_transactions (
      transaction_date,
      partner,
      transaction_type,
      amount,
      description,
      notes,
      created_by,
      external_source_key
    ) VALUES (
      COALESCE(NEW.posted_date::timestamptz, NOW()),
      NEW.personal_partner,
      'withdrawal',
      NEW.amount::numeric(10, 2),
      '[개인지출·명세] ' || LEFT(COALESCE(NEW.description, NEW.merchant, ''), 500),
      'sync:statement_lines',
      'system@partner-funds-sync',
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_statement_lines_partner_funds ON public.statement_lines;
CREATE TRIGGER trg_statement_lines_partner_funds
  AFTER INSERT OR UPDATE OR DELETE ON public.statement_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_funds_from_statement_line();

CREATE OR REPLACE FUNCTION public.sync_partner_funds_from_company_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ek TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.partner_fund_transactions
    WHERE external_source_key = 'company_expenses:' || OLD.id;
    RETURN OLD;
  END IF;

  ek := 'company_expenses:' || NEW.id;
  DELETE FROM public.partner_fund_transactions WHERE external_source_key = ek;

  -- 명세 보정으로 만든 행(statement_line_id 있음)은 statement_lines 트리거가 파트너 자금을 담당
  IF NEW.statement_line_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_personal IS TRUE AND NEW.personal_partner IS NOT NULL AND COALESCE(NEW.amount, 0) > 0 THEN
    INSERT INTO public.partner_fund_transactions (
      transaction_date,
      partner,
      transaction_type,
      amount,
      description,
      notes,
      created_by,
      external_source_key
    ) VALUES (
      COALESCE(NEW.submit_on, NOW()),
      NEW.personal_partner,
      'withdrawal',
      NEW.amount::numeric(10, 2),
      '[개인지출] ' || LEFT(COALESCE(NEW.paid_for::text, NEW.paid_to::text, ''), 500),
      'sync:company_expenses',
      COALESCE(NEW.submit_by, 'system@sync'),
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_expenses_partner_funds ON public.company_expenses;
CREATE TRIGGER trg_company_expenses_partner_funds
  AFTER INSERT OR UPDATE OR DELETE ON public.company_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_funds_from_company_expense();

CREATE OR REPLACE FUNCTION public.sync_partner_funds_from_tour_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ek TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.partner_fund_transactions
    WHERE external_source_key = 'tour_expenses:' || OLD.id;
    RETURN OLD;
  END IF;

  ek := 'tour_expenses:' || NEW.id;
  DELETE FROM public.partner_fund_transactions WHERE external_source_key = ek;

  IF NEW.is_personal IS TRUE AND NEW.personal_partner IS NOT NULL AND COALESCE(NEW.amount, 0) > 0 THEN
    INSERT INTO public.partner_fund_transactions (
      transaction_date,
      partner,
      transaction_type,
      amount,
      description,
      notes,
      created_by,
      external_source_key
    ) VALUES (
      COALESCE(NEW.submit_on, NOW()),
      NEW.personal_partner,
      'withdrawal',
      NEW.amount::numeric(10, 2),
      '[개인지출·투어] ' || LEFT(COALESCE(NEW.paid_for::text, ''), 500),
      'sync:tour_expenses',
      COALESCE(NEW.submitted_by, 'system@sync'),
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tour_expenses_partner_funds ON public.tour_expenses;
CREATE TRIGGER trg_tour_expenses_partner_funds
  AFTER INSERT OR UPDATE OR DELETE ON public.tour_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_funds_from_tour_expense();

CREATE OR REPLACE FUNCTION public.sync_partner_funds_from_reservation_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ek TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.partner_fund_transactions
    WHERE external_source_key = 'reservation_expenses:' || OLD.id;
    RETURN OLD;
  END IF;

  ek := 'reservation_expenses:' || NEW.id;
  DELETE FROM public.partner_fund_transactions WHERE external_source_key = ek;

  IF NEW.is_personal IS TRUE AND NEW.personal_partner IS NOT NULL AND COALESCE(NEW.amount, 0) > 0 THEN
    INSERT INTO public.partner_fund_transactions (
      transaction_date,
      partner,
      transaction_type,
      amount,
      description,
      notes,
      created_by,
      external_source_key
    ) VALUES (
      COALESCE(NEW.submit_on, NOW()),
      NEW.personal_partner,
      'withdrawal',
      NEW.amount::numeric(10, 2),
      '[개인지출·예약] ' || LEFT(COALESCE(NEW.paid_for::text, ''), 500),
      'sync:reservation_expenses',
      COALESCE(NEW.submitted_by, 'system@sync'),
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_expenses_partner_funds ON public.reservation_expenses;
CREATE TRIGGER trg_reservation_expenses_partner_funds
  AFTER INSERT OR UPDATE OR DELETE ON public.reservation_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_partner_funds_from_reservation_expense();

commit;
