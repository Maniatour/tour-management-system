-- Make selected ticket_bookings columns nullable if currently NOT NULL
DO $$ BEGIN
  -- company -> DROP NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_bookings' 
      AND column_name = 'company' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ticket_bookings ALTER COLUMN company DROP NOT NULL;
  END IF;

  -- ea -> DROP NOT NULL (keep default if any)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_bookings' 
      AND column_name = 'ea' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ticket_bookings ALTER COLUMN ea DROP NOT NULL;
  END IF;

  -- time -> DROP NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ticket_bookings' 
      AND column_name = 'time' 
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE ticket_bookings ALTER COLUMN time DROP NOT NULL;
  END IF;
END $$;
