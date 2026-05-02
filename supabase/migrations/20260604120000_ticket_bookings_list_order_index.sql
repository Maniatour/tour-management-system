-- 입장권 부킹 관리: submit_on DESC, id DESC 정렬 + submit_on 범위 필터 시 스캔 비용 완화
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_submit_on_id_desc
  ON public.ticket_bookings (submit_on DESC NULLS LAST, id DESC);
