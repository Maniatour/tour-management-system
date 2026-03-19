-- 입장권 부킹: 사용자는 삭제 요청만, super가 실제 삭제
-- deletion_requested_at 이 있으면 삭제 요청된 상태
ALTER TABLE ticket_bookings
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;

COMMENT ON COLUMN ticket_bookings.deletion_requested_at IS '삭제 요청 시각 (super가 실제 삭제 전까지 유지)';
COMMENT ON COLUMN ticket_bookings.deletion_requested_by IS '삭제를 요청한 사용자 이메일';
