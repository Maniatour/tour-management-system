-- 렌터카 계약서·영수증 파일 URL (vehicles)
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS rental_agreement_file_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rental_receipt_url TEXT DEFAULT NULL;

COMMENT ON COLUMN vehicles.rental_agreement_file_url IS 'Rental Agreement 파일 URL (PDF/이미지 등)';
COMMENT ON COLUMN vehicles.rental_receipt_url IS 'Rental Receipt 파일 URL (PDF/이미지 등)';
