-- Add unique constraint to reservation_pricing table
-- Migration: 20250101000091_add_unique_constraint_reservation_pricing

-- Add unique constraint on reservation_id to ensure one pricing record per reservation
ALTER TABLE reservation_pricing 
ADD CONSTRAINT reservation_pricing_reservation_id_unique 
UNIQUE (reservation_id);

-- Add comment
COMMENT ON CONSTRAINT reservation_pricing_reservation_id_unique ON reservation_pricing 
IS 'Ensures only one pricing record per reservation';
