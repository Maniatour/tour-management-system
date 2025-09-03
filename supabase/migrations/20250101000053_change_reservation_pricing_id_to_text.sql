-- Change reservation_pricing table id from UUID to TEXT
-- Migration: 20250101000053_change_reservation_pricing_id_to_text.sql

-- First, check if the table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_pricing') THEN
        RAISE NOTICE 'reservation_pricing table exists, proceeding with ID type change';
    ELSE
        RAISE NOTICE 'reservation_pricing table does not exist, skipping migration';
        RETURN;
    END IF;
END $$;

-- Step 1: Drop any foreign key constraints that reference reservation_pricing.id
-- (Check if any tables reference this table)
DO $$ 
DECLARE
    rec RECORD;
BEGIN
    -- Drop foreign key constraints that reference reservation_pricing.id
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND constraint_name LIKE '%reservation_pricing%'
    ) THEN
        RAISE NOTICE 'Dropping foreign key constraints that reference reservation_pricing';
        -- List and drop any foreign key constraints
        FOR rec IN 
            SELECT constraint_name, table_name 
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'FOREIGN KEY' 
            AND constraint_name LIKE '%reservation_pricing%'
        LOOP
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
            RAISE NOTICE 'Dropped constraint % from table %', rec.constraint_name, rec.table_name;
        END LOOP;
    ELSE
        RAISE NOTICE 'No foreign key constraints found that reference reservation_pricing';
    END IF;
END $$;

-- Step 2: Drop the primary key constraint
ALTER TABLE reservation_pricing DROP CONSTRAINT IF EXISTS reservation_pricing_pkey;

-- Step 3: Change the id column type from UUID to TEXT
ALTER TABLE reservation_pricing ALTER COLUMN id TYPE TEXT;

-- Step 4: Add a new primary key constraint
ALTER TABLE reservation_pricing ADD CONSTRAINT reservation_pricing_pkey PRIMARY KEY (id);

-- Step 5: Update any referencing columns to TEXT type
-- (Check if any tables have columns that reference reservation_pricing.id)
DO $$ 
BEGIN
    -- Check if reservations table has reservation_pricing_id column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'reservation_pricing_id'
    ) THEN
        RAISE NOTICE 'Found reservation_pricing_id column in reservations table, updating type';
        ALTER TABLE reservations ALTER COLUMN reservation_pricing_id TYPE TEXT;
        
        -- Recreate foreign key constraint
        ALTER TABLE reservations ADD CONSTRAINT reservations_reservation_pricing_id_fkey 
            FOREIGN KEY (reservation_pricing_id) REFERENCES reservation_pricing(id) ON DELETE CASCADE;
        RAISE NOTICE 'Recreated foreign key constraint for reservations.reservation_pricing_id';
    ELSE
        RAISE NOTICE 'No reservation_pricing_id column found in reservations table';
    END IF;
END $$;

-- Add comment to document the change
COMMENT ON TABLE reservation_pricing IS 'Reservation pricing table with TEXT id type for consistency';

-- Verify the change
DO $$ 
DECLARE
    col RECORD;
BEGIN
    RAISE NOTICE '=== Verification ===';
    RAISE NOTICE 'reservation_pricing table structure:';
    
    FOR col IN 
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'reservation_pricing'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable: %, default: %)', 
            col.column_name, col.data_type, col.is_nullable, col.column_default;
    END LOOP;
    
    RAISE NOTICE '=== Migration completed ===';
END $$;
