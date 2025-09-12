-- Add submitted_by column to ticket_bookings table
-- This column will store the email of the person who submitted the booking

-- Add submitted_by column
ALTER TABLE ticket_bookings 
ADD COLUMN submitted_by VARCHAR(255);

-- Add comment for the column
COMMENT ON COLUMN ticket_bookings.submitted_by IS 'Email of the person who submitted the booking';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ticket_bookings_submitted_by 
ON ticket_bookings(submitted_by);

-- Update existing records with a default value (optional)
-- UPDATE ticket_bookings 
-- SET submitted_by = 'system@maniatour.com' 
-- WHERE submitted_by IS NULL;
