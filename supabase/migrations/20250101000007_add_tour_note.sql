-- Add tour_note column to tours table
-- Migration: 20250101000007_add_tour_note

-- Add tour_note column
ALTER TABLE tours ADD COLUMN IF NOT EXISTS tour_note TEXT;

-- Add comment to document the change
COMMENT ON COLUMN tours.tour_note IS 'Additional notes or special instructions for the tour';
