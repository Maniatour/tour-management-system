-- Directions from this hotel to its group representative pickup hotel
ALTER TABLE pickup_hotels
  ADD COLUMN IF NOT EXISTS to_representative_hotel_ko TEXT,
  ADD COLUMN IF NOT EXISTS to_representative_hotel_en TEXT;

COMMENT ON COLUMN pickup_hotels.to_representative_hotel_ko IS 'Directions from this hotel to the group representative hotel (Korean)';
COMMENT ON COLUMN pickup_hotels.to_representative_hotel_en IS 'Directions from this hotel to the group representative hotel (English)';
