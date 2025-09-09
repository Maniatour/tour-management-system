-- Add commission_percent column to reservation_pricing table
-- Migration: 20250101000092_add_commission_percent_to_reservation_pricing

-- Add commission_percent column
ALTER TABLE reservation_pricing 
ADD COLUMN commission_percent DECIMAL(5,2) DEFAULT 0.00;

-- Add comment
COMMENT ON COLUMN reservation_pricing.commission_percent IS 'Commission percentage for the reservation';
