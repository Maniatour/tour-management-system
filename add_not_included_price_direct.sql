-- Add not_included_price column to dynamic_pricing table directly
-- This column is used for OTA price derivation

-- Add the column if it doesn't exist
ALTER TABLE public.dynamic_pricing
ADD COLUMN IF NOT EXISTS not_included_price NUMERIC DEFAULT 0;

-- Add comment for the column
COMMENT ON COLUMN public.dynamic_pricing.not_included_price IS 
'Amount per adult to exclude from adult_price when deriving OTA displayed price. OTA price per adult = adult_price - not_included_price.';

-- Update existing records to have default value 0
UPDATE public.dynamic_pricing 
SET not_included_price = 0 
WHERE not_included_price IS NULL;
