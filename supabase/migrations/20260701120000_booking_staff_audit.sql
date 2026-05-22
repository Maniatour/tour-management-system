-- 부킹 관리(입장권·호텔): 직원 검수(Audit) — 누가·언제 확인했는지 기록

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS audited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audited_by_email text,
  ADD COLUMN IF NOT EXISTS audited_by_name text,
  ADD COLUMN IF NOT EXISTS audited_by_nick_name text;

ALTER TABLE public.tour_hotel_bookings
  ADD COLUMN IF NOT EXISTS audited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audited_at timestamptz,
  ADD COLUMN IF NOT EXISTS audited_by_email text,
  ADD COLUMN IF NOT EXISTS audited_by_name text,
  ADD COLUMN IF NOT EXISTS audited_by_nick_name text;

COMMENT ON COLUMN public.ticket_bookings.audited IS '부킹 관리 검수(확인) 완료 여부';
COMMENT ON COLUMN public.ticket_bookings.audited_at IS '검수(확인) 일시';
COMMENT ON COLUMN public.ticket_bookings.audited_by_email IS '검수자 이메일';
COMMENT ON COLUMN public.ticket_bookings.audited_by_nick_name IS '검수자 표시명(team.nick_name 등)';

COMMENT ON COLUMN public.tour_hotel_bookings.audited IS '부킹 관리 검수(확인) 완료 여부';
COMMENT ON COLUMN public.tour_hotel_bookings.audited_at IS '검수(확인) 일시';
COMMENT ON COLUMN public.tour_hotel_bookings.audited_by_email IS '검수자 이메일';
COMMENT ON COLUMN public.tour_hotel_bookings.audited_by_nick_name IS '검수자 표시명(team.nick_name 등)';

CREATE INDEX IF NOT EXISTS idx_ticket_bookings_audited
  ON public.ticket_bookings (audited, check_in_date DESC);

CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_audited
  ON public.tour_hotel_bookings (audited, check_in_date DESC);
