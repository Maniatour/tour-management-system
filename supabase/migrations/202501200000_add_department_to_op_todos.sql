-- Add department column to op_todos table
ALTER TABLE op_todos 
ADD COLUMN department TEXT DEFAULT 'common' CHECK (department IN ('office', 'guide', 'common'));

-- Update existing records to have 'common' as default department
UPDATE op_todos 
SET department = 'common' 
WHERE department IS NULL;

-- Make department column NOT NULL after setting defaults
ALTER TABLE op_todos 
ALTER COLUMN department SET NOT NULL;

-- Add index for better performance when filtering by department
CREATE INDEX idx_op_todos_department ON op_todos(department);

-- Add comment to the column
COMMENT ON COLUMN op_todos.department IS 'Department type: office, guide, or common';

