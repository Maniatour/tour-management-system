-- Phase 1b: operator_id on customers (single-table txn)

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.customers
      ADD COLUMN operator_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ELSE
    UPDATE public.customers SET operator_id = kovegas WHERE operator_id IS NULL;
    ALTER TABLE public.customers ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
    ALTER TABLE public.customers ALTER COLUMN operator_id SET NOT NULL;
  END IF;

  BEGIN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_operator_id ON public.customers (operator_id);
