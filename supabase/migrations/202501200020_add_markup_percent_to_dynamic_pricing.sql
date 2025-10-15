-- Add markup_percent column to dynamic_pricing table
-- This column stores the percentage markup for pricing calculations

-- Add the column if it doesn't exist
ALTER TABLE public.dynamic_pricing
ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0;

-- Add comment for the column
COMMENT ON COLUMN public.dynamic_pricing.markup_percent IS 
'Percentage markup applied to base prices for dynamic pricing calculations';

-- Update existing records to have default value 0
UPDATE public.dynamic_pricing 
SET markup_percent = 0 
WHERE markup_percent IS NULL;
