-- Structured location descriptions and per-hotel vehicle access rules
ALTER TABLE pickup_hotels
  ADD COLUMN IF NOT EXISTS from_inside_hotel_ko TEXT,
  ADD COLUMN IF NOT EXISTS from_inside_hotel_en TEXT,
  ADD COLUMN IF NOT EXISTS from_outside_hotel_ko TEXT,
  ADD COLUMN IF NOT EXISTS from_outside_hotel_en TEXT;

COMMENT ON COLUMN pickup_hotels.description_ko IS 'Location description (Korean)';
COMMENT ON COLUMN pickup_hotels.description_en IS 'Location description (English)';
COMMENT ON COLUMN pickup_hotels.from_inside_hotel_ko IS 'Directions from inside the hotel (Korean)';
COMMENT ON COLUMN pickup_hotels.from_inside_hotel_en IS 'Directions from inside the hotel (English)';
COMMENT ON COLUMN pickup_hotels.from_outside_hotel_ko IS 'Directions from outside the hotel (Korean)';
COMMENT ON COLUMN pickup_hotels.from_outside_hotel_en IS 'Directions from outside the hotel (English)';
