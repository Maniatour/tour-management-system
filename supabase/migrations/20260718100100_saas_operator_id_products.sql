-- Phase 1b: operator_id on products (single-table txn — avoids multi-table deadlocks)
-- Idempotent if a previous partial run already added the column.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN operator_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ELSE
    UPDATE public.products SET operator_id = kovegas WHERE operator_id IS NULL;
    ALTER TABLE public.products ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
    ALTER TABLE public.products ALTER COLUMN operator_id SET NOT NULL;
  END IF;

  BEGIN
    ALTER TABLE public.products
      ADD CONSTRAINT products_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_operator_id ON public.products (operator_id);

COMMENT ON COLUMN public.products.operator_id IS
  'SaaS tenant. Phase 1 default/backfill = Kovegas.';
