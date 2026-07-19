-- Phase 1b: operator_id on reservations (single-table txn)
-- Hottest table — prefer low-traffic window. Idempotent.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations' AND column_name = 'operator_id'
  ) THEN
    -- PG11+: constant DEFAULT NOT NULL is metadata-only (no full rewrite)
    ALTER TABLE public.reservations
      ADD COLUMN operator_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ELSE
    UPDATE public.reservations SET operator_id = kovegas WHERE operator_id IS NULL;
    ALTER TABLE public.reservations ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
    BEGIN
      ALTER TABLE public.reservations ALTER COLUMN operator_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  BEGIN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_operator_id ON public.reservations (operator_id);

COMMENT ON COLUMN public.reservations.operator_id IS
  'SaaS tenant. Phase 1 default/backfill = Kovegas.';
