-- Extra fields for redesigned pickup hotel card/form
ALTER TABLE pickup_hotels
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS memo TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER,
  ADD COLUMN IF NOT EXISTS map_image TEXT;

COMMENT ON COLUMN pickup_hotels.landmark IS 'Reference landmark near pickup (optional)';
COMMENT ON COLUMN pickup_hotels.memo IS 'Internal memo for staff';
COMMENT ON COLUMN pickup_hotels.display_order IS 'Manual sort order within a group';
COMMENT ON COLUMN pickup_hotels.map_image IS 'Optional Google Maps / map screenshot URL';
