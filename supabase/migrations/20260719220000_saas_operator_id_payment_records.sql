-- Phase 6b.11: operator_id on payment_records
-- Backfill from reservations.operator_id; orphan → Kovegas.
-- Tenancy stamp/filter only — no booking/payment/checkout logic changes.

DO $$
DECLARE
  kovegas uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'payment_records'
      AND column_name = 'operator_id'
  ) THEN
    ALTER TABLE public.payment_records ADD COLUMN operator_id uuid NULL;
  END IF;

  UPDATE public.payment_records pr
  SET operator_id = r.operator_id
  FROM public.reservations r
  WHERE pr.reservation_id = r.id
    AND pr.operator_id IS NULL
    AND r.operator_id IS NOT NULL;

  UPDATE public.payment_records
  SET operator_id = kovegas
  WHERE operator_id IS NULL;

  ALTER TABLE public.payment_records
    ALTER COLUMN operator_id SET DEFAULT 'a0000000-0000-4000-8000-000000000001'::uuid;

  ALTER TABLE public.payment_records
    ALTER COLUMN operator_id SET NOT NULL;

  BEGIN
    ALTER TABLE public.payment_records
      ADD CONSTRAINT payment_records_operator_id_fkey
      FOREIGN KEY (operator_id) REFERENCES public.operators(id);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_records_operator_id
  ON public.payment_records (operator_id);

COMMENT ON COLUMN public.payment_records.operator_id IS
  'SaaS tenant owning this payment record. Backfilled from reservations.operator_id. Phase 6b.11.';
