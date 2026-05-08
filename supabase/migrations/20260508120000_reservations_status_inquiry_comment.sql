-- reservations.status: 문의만(inquiry) 값 문서화 (CHECK 없음 — 기존 VARCHAR 유지)

COMMENT ON COLUMN public.reservations.status IS
  '예약 상태: inquiry(문의중, 미결제), pending(대기, 결제 후 확정 대기), confirmed, completed, cancelled, recruiting, deleted 등';
