-- Fix reservation_ids column type from UUID[] to TEXT[]
-- Migration: 20250101000060_fix_reservation_ids_type.sql

-- Step 1: Add a new column with TEXT[] type
ALTER TABLE tours ADD COLUMN reservation_ids_text TEXT[];

-- Step 2: Copy data from UUID[] to TEXT[] (convert UUIDs to text)
UPDATE tours 
SET reservation_ids_text = ARRAY(
  SELECT unnest(reservation_ids)::TEXT
)
WHERE reservation_ids IS NOT NULL;

-- Step 3: Drop the old UUID[] column
ALTER TABLE tours DROP COLUMN reservation_ids;

-- Step 4: Rename the new column to the original name
ALTER TABLE tours RENAME COLUMN reservation_ids_text TO reservation_ids;

-- Step 5: Add comment to explain the change
COMMENT ON COLUMN tours.reservation_ids IS 'Array of reservation IDs as TEXT (not UUID) for flexibility with different ID formats';

-- Step 6: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tours_reservation_ids ON tours USING GIN (reservation_ids);
