-- Soft delete for unified expense tables (회사·투어·예약·입장권)

BEGIN;

ALTER TABLE public.company_expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255);

COMMENT ON COLUMN public.company_expenses.deleted_at IS '소프트 삭제 시각 (NULL = 활성)';
COMMENT ON COLUMN public.tour_expenses.deleted_at IS '소프트 삭제 시각 (NULL = 활성)';
COMMENT ON COLUMN public.reservation_expenses.deleted_at IS '소프트 삭제 시각 (NULL = 활성)';
COMMENT ON COLUMN public.ticket_bookings.deleted_at IS '소프트 삭제 시각 (NULL = 활성)';

CREATE INDEX IF NOT EXISTS idx_company_expenses_active_submit_on
  ON public.company_expenses (submit_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_active_submit_on
  ON public.tour_expenses (submit_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_active_submit_on
  ON public.reservation_expenses (submit_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_bookings_active_submit_on
  ON public.ticket_bookings (submit_on DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_expenses_deleted_at
  ON public.company_expenses (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_deleted_at
  ON public.tour_expenses (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_deleted_at
  ON public.reservation_expenses (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_bookings_deleted_at
  ON public.ticket_bookings (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- 명세 미대조 뷰: 삭제된 지출 제외
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
  );

-- 개인지출 파트너 자금: soft delete 시 동기화 제거만
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

  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

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

  IF NEW.deleted_at IS NOT NULL THEN
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
      '[개인지출·투어] ' || LEFT(COALESCE(NEW.paid_for::text, ''), 500),
      'sync:tour_expenses',
      COALESCE(NEW.submitted_by, 'system@sync'),
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

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

  IF NEW.deleted_at IS NOT NULL THEN
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
      '[개인지출·예약] ' || LEFT(COALESCE(NEW.paid_for::text, ''), 500),
      'sync:reservation_expenses',
      COALESCE(NEW.submitted_by, 'system@sync'),
      ek
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
