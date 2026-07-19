-- Phase 5c: operator_id on tours (single-table txn)
-- Backfill from product.operator_id when available, else Kovegas.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tours' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.tours
      ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.tours t
  SET operator_id = p.operator_id
  FROM public.products p
  WHERE t.product_id = p.id
    AND t.operator_id IS NULL
    AND p.operator_id IS NOT NULL;

  UPDATE public.tours
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.tours
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.tours
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.tours
      ADD CONSTRAINT tours_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_tours_operator_id ON public.tours (operator_id);

COMMENT ON COLUMN public.tours.operator_id IS
  'SaaS tenant owning this tour day. Backfilled from products.operator_id.';
