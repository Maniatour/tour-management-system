-- Per-tour flag: this tour does not need a receipt attachment.
-- Used by schedule follow-up (past tours missing receipts) and Need to check.

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS receipt_not_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS receipt_not_required_at timestamptz;

ALTER TABLE public.tours
  ADD COLUMN IF NOT EXISTS receipt_not_required_by text;

COMMENT ON COLUMN public.tours.receipt_not_required IS
  'When true, this tour does not require a receipt attachment and is hidden from missing-receipt follow-up lists.';

COMMENT ON COLUMN public.tours.receipt_not_required_at IS
  'When receipt_not_required was set.';

COMMENT ON COLUMN public.tours.receipt_not_required_by IS
  'Email of the staff member who marked receipt as not required.';
