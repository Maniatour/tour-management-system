-- Add commission_amount to reservation_pricing if missing
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'reservation_pricing'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'reservation_pricing' AND column_name = 'commission_amount'
    ) THEN
      ALTER TABLE reservation_pricing 
      ADD COLUMN commission_amount DECIMAL(10,2) DEFAULT 0.00;
    END IF;
  END IF;
END $$;

-- Optional: Comment
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reservation_pricing' AND column_name = 'commission_amount'
  ) THEN
    COMMENT ON COLUMN reservation_pricing.commission_amount IS 'Commission fixed amount for the reservation';
  END IF;
END $$;
