-- Fix reservation ID generation to use gen_random_uuid() instead of uuid_generate_v4()
-- Migration: 20250101000101_fix_reservation_id_generation

-- Update reservations table to use gen_random_uuid() for ID generation
ALTER TABLE reservations 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Add comment for clarity
COMMENT ON COLUMN reservations.id IS 'Primary key using gen_random_uuid() for Supabase compatibility';
