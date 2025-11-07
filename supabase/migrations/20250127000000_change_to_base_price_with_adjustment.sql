-- Change dynamic pricing to use base price + channel adjustment
-- Migration: 20250127000000_change_to_base_price_with_adjustment
-- 
-- Instead of storing full prices per channel, we now store:
-- - Base prices in products table (adult_base_price, child_base_price, infant_base_price)
-- - Price adjustments per channel in dynamic_pricing (price_adjustment_adult, price_adjustment_child, price_adjustment_infant)
-- Final price = base price + adjustment

-- Step 1: Add base price columns to products table if they don't exist
DO $$ 
BEGIN
  -- Add adult_base_price if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'adult_base_price') THEN
    ALTER TABLE products ADD COLUMN adult_base_price DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  -- Add child_base_price if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'child_base_price') THEN
    ALTER TABLE products ADD COLUMN child_base_price DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  -- Add infant_base_price if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'products' AND column_name = 'infant_base_price') THEN
    ALTER TABLE products ADD COLUMN infant_base_price DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Step 2: Add price adjustment columns to dynamic_pricing table
DO $$ 
BEGIN
  -- Add price_adjustment_adult if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dynamic_pricing' AND column_name = 'price_adjustment_adult') THEN
    ALTER TABLE dynamic_pricing ADD COLUMN price_adjustment_adult DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  -- Add price_adjustment_child if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dynamic_pricing' AND column_name = 'price_adjustment_child') THEN
    ALTER TABLE dynamic_pricing ADD COLUMN price_adjustment_child DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  -- Add price_adjustment_infant if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'dynamic_pricing' AND column_name = 'price_adjustment_infant') THEN
    ALTER TABLE dynamic_pricing ADD COLUMN price_adjustment_infant DECIMAL(10,2) DEFAULT 0;
  END IF;
END $$;

-- Step 3: Migrate existing data (optional - calculate adjustments from existing prices)
-- This assumes we have at least one dynamic_pricing record per product to get base prices
-- For now, we'll keep adult_price, child_price, infant_price for backward compatibility
-- but they will be calculated as: base_price + adjustment

-- Add comments to explain the new structure
COMMENT ON COLUMN products.adult_base_price IS '상품 기본 가격 (성인) - 모든 채널에 공통으로 적용되는 기본 가격';
COMMENT ON COLUMN products.child_base_price IS '상품 기본 가격 (아동) - 모든 채널에 공통으로 적용되는 기본 가격';
COMMENT ON COLUMN products.infant_base_price IS '상품 기본 가격 (유아) - 모든 채널에 공통으로 적용되는 기본 가격';
COMMENT ON COLUMN dynamic_pricing.price_adjustment_adult IS '채널별 가격 증차감 (성인) - 기본 가격에 더해지는 금액 (양수: 증액, 음수: 할인)';
COMMENT ON COLUMN dynamic_pricing.price_adjustment_child IS '채널별 가격 증차감 (아동) - 기본 가격에 더해지는 금액 (양수: 증액, 음수: 할인)';
COMMENT ON COLUMN dynamic_pricing.price_adjustment_infant IS '채널별 가격 증차감 (유아) - 기본 가격에 더해지는 금액 (양수: 증액, 음수: 할인)';

