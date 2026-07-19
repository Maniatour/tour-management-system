-- Phase 6b.0: operator_id on vehicles (fleet root; no schema rename/move)
-- Backfill all existing rows to Kovegas (Tenant #1).

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.vehicles
      ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.vehicles
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.vehicles
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.vehicles
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_operator_id ON public.vehicles (operator_id);

COMMENT ON COLUMN public.vehicles.operator_id IS
  'SaaS tenant owning this fleet vehicle. Phase 6b.0; ops_* schema split deferred.';
