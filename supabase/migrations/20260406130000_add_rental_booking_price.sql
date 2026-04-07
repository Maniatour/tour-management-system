-- 예약 시점 약정 금액 (실제 정산 총액 rental_total_cost 와 별도)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS rental_booking_price DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN vehicles.rental_booking_price IS '렌터카 예약(약정) 금액 USD';
