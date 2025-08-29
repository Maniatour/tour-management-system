-- Fix coupons table id column default value and constraints
-- The id column was changed to text but default value is not working properly

-- First, check if the id column exists and has proper constraints
DO $$ 
BEGIN
    -- Check if id column exists and is text type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coupons' 
        AND column_name = 'id'
        AND data_type = 'text'
    ) THEN
        -- Add default value for id column using gen_random_uuid()::text
        ALTER TABLE coupons ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
        RAISE NOTICE 'Updated id column default value to gen_random_uuid()::text';
        
        -- Ensure id column is NOT NULL
        ALTER TABLE coupons ALTER COLUMN id SET NOT NULL;
        RAISE NOTICE 'Ensured id column is NOT NULL';
        
        -- Add primary key constraint if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'coupons' 
            AND constraint_type = 'PRIMARY KEY'
        ) THEN
            ALTER TABLE coupons ADD CONSTRAINT coupons_pkey PRIMARY KEY (id);
            RAISE NOTICE 'Added primary key constraint to coupons table';
        ELSE
            RAISE NOTICE 'Primary key constraint already exists';
        END IF;
        
    ELSE
        RAISE NOTICE 'id column does not exist or is not text type';
    END IF;
END $$;

-- Add comment to clarify the table structure
COMMENT ON TABLE coupons IS '쿠폰 테이블 - 고정 할인과 퍼센트 할인을 모두 지원하는 이중 할인 시스템';
COMMENT ON COLUMN coupons.id IS '쿠폰 고유 식별자 (text 타입, UUID 기반)';
COMMENT ON COLUMN coupons.code IS '쿠폰 코드 (고유값)';
COMMENT ON COLUMN coupons.fixed_discount_amount IS '고정 할인 금액 ($)';
COMMENT ON COLUMN coupons.percentage_discount IS '퍼센트 할인 비율 (%)';
COMMENT ON COLUMN coupons.discount_priority IS '할인 우선순위 (fixed_first 또는 percentage_first)';
