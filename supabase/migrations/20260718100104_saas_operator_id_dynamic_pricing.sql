-- Phase 1b: operator_id on dynamic_pricing (single-table txn)
-- Hot table — run when traffic is low if lock wait occurs.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dynamic_pricing' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.dynamic_pricing
      ADD COLUMN operator_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ELSE
    UPDATE public.dynamic_pricing SET operator_id = kovegas WHERE operator_id IS NULL;
    ALTER TABLE public.dynamic_pricing ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
    ALTER TABLE public.dynamic_pricing ALTER COLUMN operator_id SET NOT NULL;
  END IF;

  BEGIN
    ALTER TABLE public.dynamic_pricing
      ADD CONSTRAINT dynamic_pricing_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_operator_id ON public.dynamic_pricing (operator_id);

COMMENT ON COLUMN public.dynamic_pricing.operator_id IS
  'SaaS tenant. Phase 1 default/backfill = Kovegas.';
