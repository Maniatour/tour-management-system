-- Add order_index column to product_schedules table for row ordering
-- Migration: 20250120000001_add_order_index_to_product_schedules

-- Add order_index column to product_schedules table
ALTER TABLE product_schedules 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- Add comment to the column
COMMENT ON COLUMN product_schedules.order_index IS 'Order index for sorting schedule items within the same day';

-- Create index for better performance when ordering
CREATE INDEX IF NOT EXISTS idx_product_schedules_order_index ON product_schedules(product_id, day_number, order_index);

-- Update existing records to have proper order_index based on current start_time
UPDATE product_schedules 
SET order_index = subquery.row_number
FROM (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY product_id, day_number 
      ORDER BY start_time ASC, id ASC
    ) as row_number
  FROM product_schedules
) as subquery
WHERE product_schedules.id = subquery.id;
