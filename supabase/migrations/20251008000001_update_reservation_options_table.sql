-- Update reservation_options table to include missing columns
-- Migration: 20251008000001_update_reservation_options_table

-- Add missing columns
ALTER TABLE reservation_options 
  ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Update total_price calculation trigger
CREATE OR REPLACE FUNCTION calculate_reservation_options_total_price()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_price = NEW.ea * NEW.price;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic total_price calculation
DROP TRIGGER IF EXISTS trigger_calculate_reservation_options_total_price ON reservation_options;
CREATE TRIGGER trigger_calculate_reservation_options_total_price
    BEFORE INSERT OR UPDATE ON reservation_options
    FOR EACH ROW
    EXECUTE FUNCTION calculate_reservation_options_total_price();

-- Update existing records to calculate total_price
UPDATE reservation_options 
SET total_price = ea * price 
WHERE total_price = 0 OR total_price IS NULL;

-- Add comments for new columns
COMMENT ON COLUMN reservation_options.total_price IS 'Total price (ea * price)';
COMMENT ON COLUMN reservation_options.note IS 'Additional notes for this option selection';

