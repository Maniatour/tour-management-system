-- Change options table id from UUID to TEXT
-- This migration changes the options table id column from UUID to TEXT type

-- First, drop any foreign key constraints that reference options.id
-- Check if there are any foreign key constraints
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find and drop foreign key constraints that reference options.id
    FOR constraint_name IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'options'::regclass 
        AND contype = 'f'
    LOOP
        EXECUTE 'ALTER TABLE options DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

-- Drop foreign key constraints that reference options.id
ALTER TABLE product_options DROP CONSTRAINT IF EXISTS product_options_linked_option_id_fkey;

-- Drop the primary key constraint
ALTER TABLE options DROP CONSTRAINT options_pkey;

-- Change the id column type from UUID to TEXT
ALTER TABLE options ALTER COLUMN id TYPE TEXT;

-- Remove the default value (UUID function)
ALTER TABLE options ALTER COLUMN id DROP DEFAULT;

-- Add a new primary key constraint
ALTER TABLE options ADD CONSTRAINT options_pkey PRIMARY KEY (id);

-- Note: audit_logs_view will need to be updated separately if it exists
