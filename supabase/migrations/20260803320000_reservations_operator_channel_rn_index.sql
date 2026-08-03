-- OTA 리뷰 예약 번호(channel_rn) 조회 가속
CREATE INDEX IF NOT EXISTS idx_reservations_operator_channel_rn
  ON public.reservations (operator_id, channel_rn)
  WHERE channel_rn IS NOT NULL AND btrim(channel_rn) <> '';
