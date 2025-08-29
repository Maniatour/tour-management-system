-- Remove id column from employees table
-- The employees table should use email as primary key

DO $$ 
BEGIN
    RAISE NOTICE '=== Removing id column from employees table ===';
    
    -- Check if id column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'id'
    ) THEN
        RAISE NOTICE 'Found id column, removing it...';
        
        -- Drop primary key constraint if it exists
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'employees' 
            AND constraint_type = 'PRIMARY KEY'
            AND constraint_name = 'employees_pkey'
        ) THEN
            ALTER TABLE employees DROP CONSTRAINT employees_pkey;
            RAISE NOTICE '✓ Dropped primary key constraint';
        END IF;
        
        -- Drop id column
        ALTER TABLE employees DROP COLUMN id;
        RAISE NOTICE '✓ Removed id column';
        
        -- Ensure email is primary key
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'employees' 
            AND constraint_type = 'PRIMARY KEY'
        ) THEN
            ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (email);
            RAISE NOTICE '✓ Added primary key constraint on email';
        END IF;
        
    ELSE
        RAISE NOTICE 'id column does not exist';
    END IF;
    
    RAISE NOTICE '=== id column removal completed ===';
END $$;

-- Verify the final structure
DO $$ 
BEGIN
    RAISE NOTICE '=== Final structure verification ===';
    
    -- Check if id column still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'id'
    ) THEN
        RAISE NOTICE 'WARNING: id column still exists!';
    ELSE
        RAISE NOTICE '✓ id column successfully removed';
    END IF;
    
    -- Check primary key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        RAISE NOTICE '✓ Primary key constraint exists';
    ELSE
        RAISE NOTICE 'WARNING: No primary key constraint found!';
    END IF;
    
    RAISE NOTICE '=== Verification completed ===';
END $$;
