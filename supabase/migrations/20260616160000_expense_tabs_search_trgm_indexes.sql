-- 투어·예약 지출, 입금·옵션·현금 관리 검색 ILIKE / 금액 부분 일치 인덱스

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm;
  END IF;
END $$;

-- tour_expenses
ALTER TABLE public.tour_expenses
  ADD COLUMN IF NOT EXISTS amount_abs_text text
  GENERATED ALWAYS AS (
    CASE WHEN amount IS NULL THEN NULL ELSE abs(amount)::text END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_trgm_paid_for
  ON public.tour_expenses USING gin (paid_for gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_trgm_paid_to
  ON public.tour_expenses USING gin (paid_to gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_trgm_note
  ON public.tour_expenses USING gin (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_trgm_tour_id
  ON public.tour_expenses USING gin (tour_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tour_expenses_trgm_amount_abs_text
  ON public.tour_expenses USING gin (amount_abs_text gin_trgm_ops);

-- reservation_expenses
ALTER TABLE public.reservation_expenses
  ADD COLUMN IF NOT EXISTS amount_abs_text text
  GENERATED ALWAYS AS (
    CASE WHEN amount IS NULL THEN NULL ELSE abs(amount)::text END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_trgm_paid_for
  ON public.reservation_expenses USING gin (paid_for gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_expenses_trgm_paid_to
  ON public.reservation_expenses USING gin (paid_to gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_expenses_trgm_note
  ON public.reservation_expenses USING gin (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_expenses_trgm_reservation_id
  ON public.reservation_expenses USING gin (reservation_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_expenses_trgm_amount_abs_text
  ON public.reservation_expenses USING gin (amount_abs_text gin_trgm_ops);

-- payment_records
ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS amount_abs_text text
  GENERATED ALWAYS AS (
    CASE WHEN amount IS NULL THEN NULL ELSE abs(amount)::text END
  ) STORED;

ALTER TABLE public.payment_records
  ADD COLUMN IF NOT EXISTS amount_krw_abs_text text
  GENERATED ALWAYS AS (
    CASE WHEN amount_krw IS NULL THEN NULL ELSE abs(amount_krw)::text END
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_payment_records_trgm_note
  ON public.payment_records USING gin (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_payment_records_trgm_reservation_id
  ON public.payment_records USING gin (reservation_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_payment_records_trgm_amount_abs_text
  ON public.payment_records USING gin (amount_abs_text gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_payment_records_trgm_amount_krw_abs_text
  ON public.payment_records USING gin (amount_krw_abs_text gin_trgm_ops);

-- reservation_options
CREATE INDEX IF NOT EXISTS idx_reservation_options_trgm_note
  ON public.reservation_options USING gin (note gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_options_trgm_reservation_id
  ON public.reservation_options USING gin (reservation_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reservation_options_trgm_option_id
  ON public.reservation_options USING gin (option_id gin_trgm_ops);

-- cash_transactions
CREATE INDEX IF NOT EXISTS idx_cash_transactions_trgm_description
  ON public.cash_transactions USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_trgm_notes
  ON public.cash_transactions USING gin (notes gin_trgm_ops);
