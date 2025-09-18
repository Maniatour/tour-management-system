-- Add submitted_by column to tour_hotel_bookings if missing
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'tour_hotel_bookings'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'tour_hotel_bookings' AND column_name = 'submitted_by'
    ) THEN
      ALTER TABLE tour_hotel_bookings 
      ADD COLUMN submitted_by VARCHAR(255);
    END IF;
  END IF;
END $$;

-- Optional: index for submitted_by
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tour_hotel_bookings' AND column_name = 'submitted_by'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_submitted_by 
    ON tour_hotel_bookings(submitted_by);
  END IF;
END $$;
