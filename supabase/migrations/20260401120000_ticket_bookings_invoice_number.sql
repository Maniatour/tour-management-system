-- 입장권 부킹 Invoice# (인보이스 번호 참조)
ALTER TABLE ticket_bookings
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(255);

COMMENT ON COLUMN ticket_bookings.invoice_number IS 'Invoice# / 인보이스 번호';
