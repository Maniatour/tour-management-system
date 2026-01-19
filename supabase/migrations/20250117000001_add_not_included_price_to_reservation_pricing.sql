-- Add not_included_price column to reservation_pricing table
-- Migration: 20250117000001_add_not_included_price_to_reservation_pricing

-- Add the column if it doesn't exist
ALTER TABLE public.reservation_pricing
ADD COLUMN IF NOT EXISTS not_included_price NUMERIC(10,2) DEFAULT 0.00;

-- Add comment for the column
COMMENT ON COLUMN public.reservation_pricing.not_included_price IS 
'Amount per person to exclude from product price. Used for OTA price derivation and pricing calculations.';

-- Update existing records to have default value 0
UPDATE public.reservation_pricing 
SET not_included_price = 0.00 
WHERE not_included_price IS NULL;
