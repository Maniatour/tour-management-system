-- Add is_favorite column to tour_courses table
ALTER TABLE tour_courses 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS favorite_order INTEGER;

-- Create index for better performance when filtering favorites
CREATE INDEX IF NOT EXISTS idx_tour_courses_is_favorite ON tour_courses(is_favorite);
CREATE INDEX IF NOT EXISTS idx_tour_courses_favorite_order ON tour_courses(favorite_order);
