-- Add is_tour column to product_schedules table
ALTER TABLE product_schedules 
ADD COLUMN is_tour BOOLEAN DEFAULT FALSE;

-- Add comment to the column
COMMENT ON COLUMN product_schedules.is_tour IS 'Whether this schedule item is a tour/sightseeing activity';
