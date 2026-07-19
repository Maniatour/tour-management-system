-- Phase 4d: OTA inbound booking webhook inbox (additive)
-- Receive → store → process (mapping required; auto inquiry behind flag).
-- See: docs/adr/019-ota-inbound-webhooks.txt

CREATE TABLE IF NOT EXISTS public.ota_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  connection_id uuid NULL
    REFERENCES public.channel_connections(id) ON DELETE SET NULL,
  platform text NOT NULL
    CHECK (platform IN ('viator', 'klook', 'gyg', 'kkday', 'trip', 'other')),
  event_type text NOT NULL DEFAULT 'booking_created'
    CHECK (event_type IN (
      'booking_created',
      'booking_updated',
      'booking_cancelled',
      'booking_status'
    )),
  external_event_id text NOT NULL,
  external_booking_id text NULL,
  external_sku text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received',
      'processing',
      'processed',
      'skipped',
      'failed'
    )),
  reservation_id text NULL,
  last_error text NULL,
  result jsonb NULL,
  processed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ota_inbound_events_operator_external_unique
    UNIQUE (operator_id, platform, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_ota_inbound_events_status_created
  ON public.ota_inbound_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ota_inbound_events_connection
  ON public.ota_inbound_events (connection_id, created_at DESC);

COMMENT ON TABLE public.ota_inbound_events IS
  'Inbound OTA webhook inbox. Unmapped SKUs must not create reservations.';

ALTER TABLE public.ota_inbound_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS ota_inbound_events_select_staff_or_member ON public.ota_inbound_events;
  CREATE POLICY ota_inbound_events_select_staff_or_member ON public.ota_inbound_events
    FOR SELECT TO authenticated
    USING (public.is_staff() OR public.is_operator_member(operator_id));

  DROP POLICY IF EXISTS ota_inbound_events_write_staff ON public.ota_inbound_events;
  CREATE POLICY ota_inbound_events_write_staff ON public.ota_inbound_events
    FOR ALL TO authenticated
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

  GRANT SELECT ON public.ota_inbound_events TO authenticated;
  GRANT ALL ON public.ota_inbound_events TO service_role;
END $$;
