-- Add id column to employees table while keeping email as primary key
-- This resolves the "record 'new' has no field 'id'" error

DO $$
BEGIN
    RAISE NOTICE '=== Adding id column to employees table ===';
    
    -- Check if id column already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'employees'
        AND column_name = 'id'
    ) THEN
        -- Add id column with UUID default
        ALTER TABLE employees ADD COLUMN id UUID DEFAULT gen_random_uuid();
        RAISE NOTICE '✓ Added id column with UUID default';
        
        -- Make id column NOT NULL
        ALTER TABLE employees ALTER COLUMN id SET NOT NULL;
        RAISE NOTICE '✓ Made id column NOT NULL';
        
        -- Add unique constraint on id
        ALTER TABLE employees ADD CONSTRAINT employees_id_unique UNIQUE (id);
        RAISE NOTICE '✓ Added unique constraint on id';
        
        -- Update existing records to have UUID values
        UPDATE employees SET id = gen_random_uuid() WHERE id IS NULL;
        RAISE NOTICE '✓ Updated existing records with UUID values';
        
    ELSE
        RAISE NOTICE 'id column already exists';
    END IF;
    
    RAISE NOTICE '=== id column addition completed ===';
END $$;

-- Add comments to clarify the purpose
COMMENT ON COLUMN employees.id IS '직원 고유 식별자 (UUID, 자동 생성)';
COMMENT ON COLUMN employees.email IS '직원 이메일 (기본키, 고유값)';
COMMENT ON TABLE employees IS '직원 정보 테이블 - email을 기본키로 사용하며 id는 UUID 식별자';
