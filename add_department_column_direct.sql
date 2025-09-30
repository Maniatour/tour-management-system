-- Add department column to op_todos table directly
-- First check if column already exists
DO $$ 
BEGIN
    -- Check if department column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'op_todos' 
        AND column_name = 'department'
    ) THEN
        -- Add the column
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
        CREATE INDEX IF NOT EXISTS idx_op_todos_department ON op_todos(department);
        
        -- Add comment to the column
        COMMENT ON COLUMN op_todos.department IS 'Department type: office, guide, or common';
        
        RAISE NOTICE 'Department column added successfully to op_todos table';
    ELSE
        RAISE NOTICE 'Department column already exists in op_todos table';
    END IF;
END $$;

