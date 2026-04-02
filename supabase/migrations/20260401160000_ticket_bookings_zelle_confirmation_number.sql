-- Zelle 결제 시 Confirmation 번호 (Invoice # 등과 함께 결제 추적용)
ALTER TABLE ticket_bookings
  ADD COLUMN IF NOT EXISTS zelle_confirmation_number VARCHAR(255);

COMMENT ON COLUMN ticket_bookings.zelle_confirmation_number IS 'Zelle 결제 시 Confirmation 번호';
