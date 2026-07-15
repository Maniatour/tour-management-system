-- Payable invoices: Stripe Hosted Invoice fields + public pay token

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_invoice_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS hosted_invoice_url text,
  ADD COLUMN IF NOT EXISTS stripe_invoice_status text,
  ADD COLUMN IF NOT EXISTS payment_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill tokens for existing rows
UPDATE public.invoices
SET payment_token = gen_random_uuid()
WHERE payment_token IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN payment_token SET DEFAULT gen_random_uuid(),
  ALTER COLUMN payment_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_token
  ON public.invoices (payment_token);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id
  ON public.invoices (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.stripe_invoice_id IS 'Stripe Invoice id (in_...)';
COMMENT ON COLUMN public.invoices.hosted_invoice_url IS 'Stripe Hosted Invoice payment URL';
COMMENT ON COLUMN public.invoices.payment_token IS 'Public token for /{locale}/pay/invoice/[token] redirect';
COMMENT ON COLUMN public.invoices.paid_at IS 'When invoice was marked paid (Stripe invoice.paid webhook)';
