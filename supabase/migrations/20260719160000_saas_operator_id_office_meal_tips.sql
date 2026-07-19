-- Phase 6b.4: operator_id on office_meal_log + tour_office_tips
-- Meal: Kovegas backfill; unique becomes (operator_id, meal_date, employee_email)
-- Office tips: backfill from tours.operator_id when present, else Kovegas
-- tour_tip_shares deferred (more call sites / guide path)

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- office_meal_log
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'office_meal_log' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.office_meal_log ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.office_meal_log SET operator_id = kovegas WHERE operator_id IS NULL;

  ALTER TABLE public.office_meal_log
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.office_meal_log
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.office_meal_log
      ADD CONSTRAINT office_meal_log_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  ALTER TABLE public.office_meal_log
    DROP CONSTRAINT IF EXISTS office_meal_log_meal_date_employee_email_key;

  BEGIN
    ALTER TABLE public.office_meal_log
      ADD CONSTRAINT office_meal_log_operator_date_email_key
      UNIQUE (operator_id, meal_date, employee_email);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- tour_office_tips
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tour_office_tips' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.tour_office_tips ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.tour_office_tips tot
  SET operator_id = t.operator_id
  FROM public.tours t
  WHERE tot.tour_id = t.id
    AND tot.operator_id IS NULL
    AND t.operator_id IS NOT NULL;

  UPDATE public.tour_office_tips
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.tour_office_tips
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.tour_office_tips
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.tour_office_tips
      ADD CONSTRAINT tour_office_tips_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_office_meal_log_operator_id
  ON public.office_meal_log (operator_id);

CREATE INDEX IF NOT EXISTS idx_tour_office_tips_operator_id
  ON public.tour_office_tips (operator_id);

COMMENT ON COLUMN public.office_meal_log.operator_id IS
  'SaaS tenant owning this meal log row. Phase 6b.4.';

COMMENT ON COLUMN public.tour_office_tips.operator_id IS
  'SaaS tenant owning this office tip row. Backfilled from tours.operator_id.';
