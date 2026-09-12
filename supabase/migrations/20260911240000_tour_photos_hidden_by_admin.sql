-- Admin can hide individual tour photos from customer share pages.
ALTER TABLE tour_photos
  ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tour_photos_hidden_by_admin
  ON tour_photos (tour_id)
  WHERE hidden_by_admin = true;

COMMENT ON COLUMN tour_photos.hidden_by_admin IS
  'When true, the photo is hidden from customer share pages and guest galleries. Admins still see it.';
