-- Check and fix employees table structure
-- This migration will verify the current state and make any necessary corrections

-- Check current table structure
DO $$ 
BEGIN
    RAISE NOTICE '=== Checking employees table structure ===';
    
    -- Check if id column still exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'id'
    ) THEN
        RAISE NOTICE 'WARNING: id column still exists in employees table';
    ELSE
        RAISE NOTICE '✓ id column has been removed from employees table';
    END IF;
    
    -- Check if email is primary key
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'employees_pkey'
    ) THEN
        RAISE NOTICE '✓ employees_pkey primary key constraint exists';
    ELSE
        RAISE NOTICE 'WARNING: employees_pkey primary key constraint does not exist';
    END IF;
    
    -- Check if email column is NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'email'
        AND is_nullable = 'NO'
    ) THEN
        RAISE NOTICE '✓ email column is NOT NULL';
    ELSE
        RAISE NOTICE 'WARNING: email column is nullable';
    END IF;
    
    -- Check if email unique constraint exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'employees_email_unique'
    ) THEN
        RAISE NOTICE '✓ employees_email_unique unique constraint exists';
    ELSE
        RAISE NOTICE 'WARNING: employees_email_unique unique constraint does not exist';
    END IF;
    
    -- Check tours table foreign key constraints
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tours' 
        AND constraint_name = 'tours_tour_guide_id_fkey'
    ) THEN
        RAISE NOTICE '✓ tours_tour_guide_id_fkey foreign key constraint exists';
    ELSE
        RAISE NOTICE 'WARNING: tours_tour_guide_id_fkey foreign key constraint does not exist';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tours' 
        AND constraint_name = 'tours_assistant_id_fkey'
    ) THEN
        RAISE NOTICE '✓ tours_assistant_id_fkey foreign key constraint exists';
    ELSE
        RAISE NOTICE 'WARNING: tours_assistant_id_fkey foreign key constraint does not exist';
    END IF;
    
    RAISE NOTICE '=== Structure check completed ===';
END $$;

-- Force remove id column if it still exists (with error handling)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'id'
    ) THEN
        RAISE NOTICE 'Removing id column...';
        ALTER TABLE employees DROP COLUMN id;
        RAISE NOTICE '✓ id column removed';
    ELSE
        RAISE NOTICE 'id column does not exist, skipping removal';
    END IF;
END $$;

-- Ensure email is primary key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        RAISE NOTICE 'Adding primary key constraint on email...';
        ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (email);
        RAISE NOTICE '✓ Primary key constraint added';
    ELSE
        RAISE NOTICE 'Primary key constraint already exists';
    END IF;
END $$;

-- Ensure email is NOT NULL
ALTER TABLE employees ALTER COLUMN email SET NOT NULL;

-- Ensure email unique constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name = 'employees_email_unique'
    ) THEN
        RAISE NOTICE 'Adding unique constraint on email...';
        ALTER TABLE employees ADD CONSTRAINT employees_email_unique UNIQUE (email);
        RAISE NOTICE '✓ Unique constraint added';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END $$;

-- Verify final structure
DO $$ 
DECLARE
    col RECORD;
    con RECORD;
BEGIN
    RAISE NOTICE '=== Final verification ===';
    
    -- List all columns in employees table
    RAISE NOTICE 'Employees table columns:';
    FOR col IN 
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'employees'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %, default: %)', 
            col.column_name, col.data_type, col.is_nullable, col.column_default;
    END LOOP;
    
    -- List all constraints
    RAISE NOTICE 'Employees table constraints:';
    FOR con IN 
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints 
        WHERE table_name = 'employees'
        ORDER BY constraint_type, constraint_name
    LOOP
        RAISE NOTICE '  %: %', con.constraint_name, con.constraint_type;
    END LOOP;
    
    RAISE NOTICE '=== Verification completed ===';
END $$;
