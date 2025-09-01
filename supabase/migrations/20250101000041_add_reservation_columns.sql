-- Add missing columns to reservations table
-- Migration: 20250101000041_add_reservation_columns.sql

-- Add tour_id column
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'tour_id') THEN
    ALTER TABLE reservations ADD COLUMN tour_id VARCHAR(255);
  END IF;
END $$;

-- Add selected_options column (JSONB for storing option selections)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'selected_options') THEN
    ALTER TABLE reservations ADD COLUMN selected_options JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add selected_option_prices column (JSONB for storing custom option prices)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservations' AND column_name = 'selected_option_prices') THEN
    ALTER TABLE reservations ADD COLUMN selected_option_prices JSONB DEFAULT '{}';
  END IF;
END $$;

-- Add index for tour_id for better performance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reservations_tour_id') THEN
    CREATE INDEX idx_reservations_tour_id ON reservations(tour_id);
  END IF;
END $$;

-- Add index for selected_options for better JSONB query performance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reservations_selected_options') THEN
    CREATE INDEX idx_reservations_selected_options ON reservations USING GIN (selected_options);
  END IF;
END $$;

-- Add index for selected_option_prices for better JSONB query performance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reservations_selected_option_prices') THEN
    CREATE INDEX idx_reservations_selected_option_prices ON reservations USING GIN (selected_option_prices);
  END IF;
END $$;
