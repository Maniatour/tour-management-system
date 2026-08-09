-- 렌터카 예약 확인(Rental reservations) 스크린샷/파일 URL
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS rental_reservation_url TEXT DEFAULT NULL;

COMMENT ON COLUMN vehicles.rental_reservation_url IS 'Rental reservations 스크린샷/파일 URL (PDF/이미지 등)';

-- 스크린샷(WebP) 업로드 허용
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
WHERE id = 'vehicle-rental-files';
