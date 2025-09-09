-- Remove is_private_tour column from reservation_pricing table
-- This column should be in reservations table instead
ALTER TABLE reservation_pricing
DROP COLUMN IF EXISTS is_private_tour;
