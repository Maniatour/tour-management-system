-- Guest flow: NPS / residency survey, uploads, optional Stripe payment (token in email URL).
-- Access only via Next.js API using service_role (RLS enabled, no policies for anon/authenticated).

CREATE TABLE IF NOT EXISTS public.resident_check_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_resident_check_tokens_reservation_id
  ON public.resident_check_tokens (reservation_id);

CREATE INDEX IF NOT EXISTS idx_resident_check_tokens_expires_at
  ON public.resident_check_tokens (expires_at);

COMMENT ON TABLE public.resident_check_tokens IS 'Email magic-link token (sha256 hash only); raw token never stored.';

CREATE TABLE IF NOT EXISTS public.resident_check_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL UNIQUE REFERENCES public.resident_check_tokens (id) ON DELETE CASCADE,
  residency text NOT NULL CHECK (residency IN ('us_resident', 'non_resident', 'mixed')),
  non_resident_16_plus_count integer NOT NULL DEFAULT 0
    CHECK (non_resident_16_plus_count >= 0 AND non_resident_16_plus_count <= 500),
  agreed boolean NOT NULL DEFAULT false,
  payment_method text NULL CHECK (payment_method IS NULL OR payment_method IN ('card', 'cash')),
  pass_assistance_requested boolean NOT NULL DEFAULT false,
  has_annual_pass boolean NULL,
  pass_photo_url text NULL,
  id_proof_url text NULL,
  stripe_payment_intent_id text NULL,
  stripe_payment_status text NULL,
  nps_fee_usd_cents integer NOT NULL DEFAULT 0,
  card_processing_fee_usd_cents integer NOT NULL DEFAULT 0,
  total_charge_usd_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.resident_check_submissions IS 'One row per access token; guest survey + payment state.';

ALTER TABLE public.resident_check_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_check_submissions ENABLE ROW LEVEL SECURITY;
