-- Add is_active column to pickup_hotels table
ALTER TABLE pickup_hotels 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add index for better performance when filtering active hotels
CREATE INDEX IF NOT EXISTS idx_pickup_hotels_is_active ON pickup_hotels(is_active);

-- Update existing records to be active by default
UPDATE pickup_hotels 
SET is_active = true 
WHERE is_active IS NULL;

-- Add comment to the column
COMMENT ON COLUMN pickup_hotels.is_active IS '픽업 호텔 활성화 상태 (true: 사용 가능, false: 사용 불가)';
