-- 입장권 부킹 v2 실험 스키마 제거 (기존 ticket_bookings 는 유지)

DROP TABLE IF EXISTS public.ticket_booking_v2_events CASCADE;
DROP TABLE IF EXISTS public.ticket_booking_v2_credits CASCADE;
DROP TABLE IF EXISTS public.ticket_booking_v2_payments CASCADE;
DROP TABLE IF EXISTS public.ticket_booking_v2_adjustments CASCADE;
DROP TABLE IF EXISTS public.ticket_booking_v2_allotments CASCADE;

DROP FUNCTION IF EXISTS public.apply_ticket_booking_v2_action(text, text, jsonb);
DROP FUNCTION IF EXISTS public.ticket_booking_v2_log_event(text, text, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.ticket_booking_v2_allotment_snapshot(text);
DROP FUNCTION IF EXISTS public.ticket_booking_v2_actor();
DROP FUNCTION IF EXISTS public.ticket_booking_v2_cancel_due_simple(text, date);
DROP FUNCTION IF EXISTS public.ticket_booking_v2_set_updated_at() CASCADE;
