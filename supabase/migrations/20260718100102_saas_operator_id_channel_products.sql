-- Phase 1b: operator_id on channel_products (single-table txn)

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'channel_products' AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.channel_products
      ADD COLUMN operator_id uuid NOT NULL DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
  ELSE
    UPDATE public.channel_products SET operator_id = kovegas WHERE operator_id IS NULL;
    ALTER TABLE public.channel_products ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;
    ALTER TABLE public.channel_products ALTER COLUMN operator_id SET NOT NULL;
  END IF;

  BEGIN
    ALTER TABLE public.channel_products
      ADD CONSTRAINT channel_products_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_channel_products_operator_id ON public.channel_products (operator_id);
