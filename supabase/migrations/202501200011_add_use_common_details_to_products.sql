-- Add use_common_details column to products table
-- This column is used to determine if a product should use common details from product_details_common table

-- Add the column if it doesn't exist
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS use_common_details BOOLEAN NOT NULL DEFAULT FALSE;

-- Add comment for the column
COMMENT ON COLUMN public.products.use_common_details IS 
'Whether to use common product details from product_details_common table based on sub_category';

-- Update existing records to have default value FALSE
UPDATE public.products 
SET use_common_details = FALSE 
WHERE use_common_details IS NULL;
