-- Phase 6b.1: operator_id on vehicle_maintenance + vehicle_maintenance_schedules
-- Backfill from vehicles.operator_id when present, else Kovegas.
-- Catalog stays shared (platform reference); no schema rename/move.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  -- vehicle_maintenance
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicle_maintenance' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.vehicle_maintenance
      ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.vehicle_maintenance vm
  SET operator_id = v.operator_id
  FROM public.vehicles v
  WHERE vm.vehicle_id = v.id
    AND vm.operator_id IS NULL
    AND v.operator_id IS NOT NULL;

  UPDATE public.vehicle_maintenance
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.vehicle_maintenance
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.vehicle_maintenance
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.vehicle_maintenance
      ADD CONSTRAINT vehicle_maintenance_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  -- vehicle_maintenance_schedules
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vehicle_maintenance_schedules'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.vehicle_maintenance_schedules
      ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.vehicle_maintenance_schedules s
  SET operator_id = v.operator_id
  FROM public.vehicles v
  WHERE s.vehicle_id = v.id
    AND s.operator_id IS NULL
    AND v.operator_id IS NOT NULL;

  UPDATE public.vehicle_maintenance_schedules
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.vehicle_maintenance_schedules
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.vehicle_maintenance_schedules
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.vehicle_maintenance_schedules
      ADD CONSTRAINT vehicle_maintenance_schedules_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_operator_id
  ON public.vehicle_maintenance (operator_id);

CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_schedules_operator_id
  ON public.vehicle_maintenance_schedules (operator_id);

COMMENT ON COLUMN public.vehicle_maintenance.operator_id IS
  'SaaS tenant owning this maintenance record. Backfilled from vehicles.operator_id.';

COMMENT ON COLUMN public.vehicle_maintenance_schedules.operator_id IS
  'SaaS tenant owning this schedule row. Backfilled from vehicles.operator_id.';
