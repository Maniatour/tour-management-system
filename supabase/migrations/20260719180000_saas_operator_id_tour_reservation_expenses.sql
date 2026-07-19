-- Phase 6b.6: operator_id on tour_expenses + reservation_expenses
-- Backfill from tours / reservations; orphan rows → Kovegas.
-- Views *_no_statement_match use SELECT * so the column is included.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- tour_expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tour_expenses'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.tour_expenses ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.tour_expenses te
  SET operator_id = t.operator_id
  FROM public.tours t
  WHERE te.tour_id = t.id
    AND te.operator_id IS NULL
    AND t.operator_id IS NOT NULL;

  UPDATE public.tour_expenses
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.tour_expenses
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.tour_expenses
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.tour_expenses
      ADD CONSTRAINT tour_expenses_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- reservation_expenses
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservation_expenses'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.reservation_expenses ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.reservation_expenses re
  SET operator_id = r.operator_id
  FROM public.reservations r
  WHERE re.reservation_id = r.id
    AND re.operator_id IS NULL
    AND r.operator_id IS NOT NULL;

  UPDATE public.reservation_expenses re
  SET operator_id = t.operator_id
  FROM public.tours t
  WHERE re.tour_id = t.id
    AND re.operator_id IS NULL
    AND t.operator_id IS NOT NULL;

  UPDATE public.reservation_expenses
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.reservation_expenses
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.reservation_expenses
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.reservation_expenses
      ADD CONSTRAINT reservation_expenses_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_tour_expenses_operator_id
  ON public.tour_expenses (operator_id);

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_operator_id
  ON public.reservation_expenses (operator_id);

COMMENT ON COLUMN public.tour_expenses.operator_id IS
  'SaaS tenant owning this tour expense. Backfilled from tours.operator_id. Phase 6b.6.';

COMMENT ON COLUMN public.reservation_expenses.operator_id IS
  'SaaS tenant owning this reservation expense. Backfilled from reservations/tours. Phase 6b.6.';
