-- Update employees table: remove id column and make email the primary key
-- This will simplify the table structure and use email as the unique identifier

-- First, check if the table exists and has the expected structure
DO $$ 
BEGIN
    -- Check if employees table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'employees'
    ) THEN
        RAISE NOTICE 'Employees table exists, proceeding with modifications';
        
        -- Check if id column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'employees' 
            AND column_name = 'id'
        ) THEN
            RAISE NOTICE 'id column exists, will be removed';
        ELSE
            RAISE NOTICE 'id column does not exist';
        END IF;
        
        -- Check if email column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'employees' 
            AND column_name = 'email'
        ) THEN
            RAISE NOTICE 'email column exists, will be made primary key';
        ELSE
            RAISE NOTICE 'email column does not exist, cannot proceed';
            RETURN;
        END IF;
        
    ELSE
        RAISE NOTICE 'Employees table does not exist, cannot proceed';
        RETURN;
    END IF;
END $$;

-- First, handle foreign key constraints that reference employees.id
-- Update tours table to use email instead of id for foreign keys

-- Drop existing foreign key constraints
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tours' 
        AND constraint_name = 'tours_tour_guide_id_fkey'
    ) THEN
        ALTER TABLE tours DROP CONSTRAINT tours_tour_guide_id_fkey;
        RAISE NOTICE 'Dropped tours_tour_guide_id_fkey constraint';
    ELSE
        RAISE NOTICE 'tours_tour_guide_id_fkey constraint does not exist';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'tours' 
        AND constraint_name = 'tours_assistant_id_fkey'
    ) THEN
        ALTER TABLE tours DROP CONSTRAINT tours_assistant_id_fkey;
        RAISE NOTICE 'Dropped tours_assistant_id_fkey constraint';
    ELSE
        RAISE NOTICE 'tours_assistant_id_fkey constraint does not exist';
    END IF;
END $$;

-- Change tour_guide_id and assistant_id columns from UUID to TEXT (email)
ALTER TABLE tours ALTER COLUMN tour_guide_id TYPE text;
ALTER TABLE tours ALTER COLUMN assistant_id TYPE text;

-- Add new foreign key constraints using email
ALTER TABLE tours ADD CONSTRAINT tours_tour_guide_id_fkey 
    FOREIGN KEY (tour_guide_id) REFERENCES employees(email) ON DELETE SET NULL;

ALTER TABLE tours ADD CONSTRAINT tours_assistant_id_fkey 
    FOREIGN KEY (assistant_id) REFERENCES employees(email) ON DELETE SET NULL;

-- Now drop existing primary key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'employees' 
        AND constraint_type = 'PRIMARY KEY'
    ) THEN
        ALTER TABLE employees DROP CONSTRAINT employees_pkey;
        RAISE NOTICE 'Dropped existing primary key constraint';
    ELSE
        RAISE NOTICE 'No existing primary key constraint found';
    END IF;
END $$;

-- Remove id column if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'id'
    ) THEN
        ALTER TABLE employees DROP COLUMN id;
        RAISE NOTICE 'Removed id column';
    ELSE
        RAISE NOTICE 'id column does not exist, skipping removal';
    END IF;
END $$;

-- Ensure email column is NOT NULL and UNIQUE
ALTER TABLE employees ALTER COLUMN email SET NOT NULL;
ALTER TABLE employees ADD CONSTRAINT employees_email_unique UNIQUE (email);

-- Add primary key constraint on email
ALTER TABLE employees ADD CONSTRAINT employees_pkey PRIMARY KEY (email);

-- Add comments to clarify the new structure
COMMENT ON TABLE employees IS '직원 테이블 - email을 Primary Key로 사용';
COMMENT ON COLUMN employees.email IS '직원 이메일 (Primary Key, 고유값)';
COMMENT ON COLUMN employees.name_ko IS '한국어 이름';
COMMENT ON COLUMN employees.name_en IS '영어 이름';
COMMENT ON COLUMN employees.language IS '사용 언어';
COMMENT ON COLUMN employees.type IS '직원 유형';
COMMENT ON COLUMN employees.phone IS '전화번호';
COMMENT ON COLUMN employees.emergency_contact IS '비상연락처';
COMMENT ON COLUMN employees.is_active IS '활성 상태';
COMMENT ON COLUMN employees.date_of_birth IS '생년월일';
COMMENT ON COLUMN employees.address IS '주소';
COMMENT ON COLUMN employees.ssn IS '주민번호';
COMMENT ON COLUMN employees.photo IS '사진';
COMMENT ON COLUMN employees.personal_car_model IS '개인 차량 모델';
COMMENT ON COLUMN employees.car_year IS '차량 연도';
COMMENT ON COLUMN employees.car_plate IS '차량 번호판';
COMMENT ON COLUMN employees.bank_name IS '은행명';
COMMENT ON COLUMN employees.account_holder IS '계좌 소유자';
COMMENT ON COLUMN employees.bank_number IS '계좌번호';
COMMENT ON COLUMN employees.routing_number IS '라우팅 번호';
COMMENT ON COLUMN employees.cpr IS 'CPR 자격';
COMMENT ON COLUMN employees.cpr_acquired IS 'CPR 취득일';
COMMENT ON COLUMN employees.cpr_expired IS 'CPR 만료일';
COMMENT ON COLUMN employees.medical_report IS '의료 보고서';
COMMENT ON COLUMN employees.medical_acquired IS '의료 보고서 취득일';
COMMENT ON COLUMN employees.medical_expired IS '의료 보고서 만료일';
COMMENT ON COLUMN employees.status IS '상태';
COMMENT ON COLUMN employees.created_at IS '생성일';
