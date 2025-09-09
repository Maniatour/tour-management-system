-- Add is_private_tour column to tours table
ALTER TABLE tours
ADD COLUMN is_private_tour BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN tours.is_private_tour IS 'Indicates if this tour is a private tour';

-- Update existing tours based on their reservations
-- If any reservation in the tour is private, mark the tour as private
UPDATE tours 
SET is_private_tour = TRUE
WHERE id IN (
  SELECT DISTINCT t.id
  FROM tours t
  JOIN reservations r ON r.tour_id = t.id
  WHERE r.is_private_tour = TRUE
);
