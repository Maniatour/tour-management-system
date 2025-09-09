-- Add is_private_tour column to reservations table
ALTER TABLE reservations
ADD COLUMN is_private_tour BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN reservations.is_private_tour IS 'Indicates if this is a private tour reservation';
