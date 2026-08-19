-- 입장권 부킹 예약 축: 날씨 취소 (결제 전/후 벤더 크레딧 팔로업)

ALTER TABLE public.ticket_bookings DROP CONSTRAINT IF EXISTS ticket_bookings_booking_status_check;
ALTER TABLE public.ticket_bookings ADD CONSTRAINT ticket_bookings_booking_status_check CHECK (
  booking_status = ANY (ARRAY[
    'requested',
    'on_hold',
    'tentative',
    'confirmed',
    'cancel_requested',
    'cancelled',
    'weather_cancelled',
    'no_show',
    'failed',
    'expired'
  ]::text[])
);

COMMENT ON COLUMN public.ticket_bookings.booking_status IS
  '예약 단계: requested|on_hold|tentative|confirmed|cancel_requested|cancelled|weather_cancelled|no_show|failed|expired';

CREATE OR REPLACE FUNCTION public.ticket_booking_derive_legacy_status(
  bs text,
  vs text,
  cs text,
  ps text,
  rs text,
  os text
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN bs = 'weather_cancelled' THEN 'cancelled'
    WHEN bs = 'cancelled' THEN 'cancelled'
    WHEN bs = 'cancel_requested' THEN 'cancellation_requested'
    WHEN bs IN ('failed', 'expired') THEN 'cancelled'
    WHEN rs IN ('credit_received', 'partially_refunded') THEN 'credit'
    WHEN rs = 'refunded' THEN 'cancelled'
    WHEN cs = 'requested' AND bs IN ('confirmed', 'tentative', 'on_hold') THEN 'guest_change_requested'
    WHEN ps = 'requested' AND bs = 'confirmed' THEN 'payment_requested'
    WHEN ps IN ('failed', 'partially_paid') THEN 'pending'
    WHEN bs = 'confirmed' AND ps = 'paid' THEN 'completed'
    WHEN bs = 'confirmed' THEN 'confirmed'
    WHEN bs = 'tentative' THEN 'tentative'
    WHEN bs IN ('on_hold', 'requested') THEN 'pending'
    WHEN bs = 'no_show' THEN 'completed'
    ELSE 'pending'
  END;
$$;
