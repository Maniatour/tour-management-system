-- Remove discount_percent column from options table if it exists
-- This column is not needed and may cause confusion

-- Check if the column exists and remove it
DO $$ 
BEGIN
    -- Check if discount_percent column exists in options table
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'options' 
        AND column_name = 'discount_percent'
    ) THEN
        -- Remove the column if it exists
        ALTER TABLE options DROP COLUMN discount_percent;
        RAISE NOTICE 'Removed discount_percent column from options table';
    ELSE
        RAISE NOTICE 'discount_percent column does not exist in options table';
    END IF;
END $$;

-- Add comment to clarify the table structure
COMMENT ON TABLE options IS '상품 옵션 테이블 - 할인 관련 컬럼은 coupons 테이블에서 관리';
