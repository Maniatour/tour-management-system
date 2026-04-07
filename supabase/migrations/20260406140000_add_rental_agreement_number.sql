-- 렌터카 계약서 번호 (예약/RN과 별도)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS rental_agreement_number TEXT DEFAULT NULL;

COMMENT ON COLUMN vehicles.rental_agreement_number IS 'Rental Agreement # — 예약 번호·RN과 다를 수 있음';
