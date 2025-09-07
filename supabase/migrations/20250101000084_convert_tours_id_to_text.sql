-- Convert tours.id from UUID to TEXT to match other tables
-- Migration: 20250101000084_convert_tours_id_to_text

-- First, drop all foreign key constraints that reference tours(id) (if they exist)
DO $$ 
BEGIN
    -- Drop foreign key constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'reservations_tour_id_fkey' 
               AND table_name = 'reservations') THEN
        ALTER TABLE reservations DROP CONSTRAINT reservations_tour_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'ticket_bookings_tour_id_fkey' 
               AND table_name = 'ticket_bookings') THEN
        ALTER TABLE ticket_bookings DROP CONSTRAINT ticket_bookings_tour_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'tour_hotel_bookings_tour_id_fkey' 
               AND table_name = 'tour_hotel_bookings') THEN
        ALTER TABLE tour_hotel_bookings DROP CONSTRAINT tour_hotel_bookings_tour_id_fkey;
    END IF;
END $$;

-- Change tours.id from UUID to TEXT
ALTER TABLE tours 
ALTER COLUMN id TYPE TEXT USING id::text;

-- Clean up invalid tour_id references before adding foreign key constraints
-- Set tour_id to NULL for records that reference non-existent tours
UPDATE reservations 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

UPDATE ticket_bookings 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

UPDATE tour_hotel_bookings 
SET tour_id = NULL 
WHERE tour_id IS NOT NULL 
AND tour_id NOT IN (SELECT id FROM tours);

-- Recreate foreign key constraints for tables that have tour_id columns
DO $$
BEGIN
    -- Add foreign key constraint for reservations if tour_id column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'reservations' AND column_name = 'tour_id') THEN
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_tour_id_fkey 
        FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
    END IF;
    
    -- Add foreign key constraint for ticket_bookings
    ALTER TABLE ticket_bookings 
    ADD CONSTRAINT ticket_bookings_tour_id_fkey 
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
    
    -- Add foreign key constraint for tour_hotel_bookings
    ALTER TABLE tour_hotel_bookings 
    ADD CONSTRAINT tour_hotel_bookings_tour_id_fkey 
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE SET NULL;
END $$;

-- Update indexes to match the new type
DROP INDEX IF EXISTS idx_ticket_bookings_tour_id;
DROP INDEX IF EXISTS idx_tour_hotel_bookings_tour_id;

CREATE INDEX idx_ticket_bookings_tour_id ON ticket_bookings(tour_id);
CREATE INDEX idx_tour_hotel_bookings_tour_id ON tour_hotel_bookings(tour_id);
