-- Add submitted_by column to tour_hotel_bookings table
-- This column will store the email of the person who submitted the booking

-- Add submitted_by column
ALTER TABLE tour_hotel_bookings 
ADD COLUMN submitted_by VARCHAR(255);

-- Add comment for the column
COMMENT ON COLUMN tour_hotel_bookings.submitted_by IS 'Email of the person who submitted the booking';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_submitted_by 
ON tour_hotel_bookings(submitted_by);

-- Update existing records with a default value (optional)
-- UPDATE tour_hotel_bookings 
-- SET submitted_by = 'system@maniatour.com' 
-- WHERE submitted_by IS NULL;
