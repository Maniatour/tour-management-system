-- customers, reservations, tours 테이블의 id 컬럼 타입을 text로 변경
-- 이 마이그레이션은 기존 데이터를 보존하면서 컬럼 타입을 변경합니다

-- 1. 현재 테이블 구조 확인을 위한 로그
DO $$
BEGIN
    RAISE NOTICE 'Starting migration to change ID columns to text type';
    
    -- customers 테이블 구조 확인
    RAISE NOTICE 'Checking customers table structure...';
    
    -- reservations 테이블 구조 확인
    RAISE NOTICE 'Checking reservations table structure...';
    
    -- tours 테이블 구조 확인
    RAISE NOTICE 'Checking tours table structure...';
END $$;

-- 2. 외래 키 제약 조건 해제 (존재하는 경우에만)
ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_customer_id_fkey;

-- 3. 기본 키 제약 조건 해제 (존재하는 경우에만)
ALTER TABLE customers 
DROP CONSTRAINT IF EXISTS customers_pkey;

ALTER TABLE reservations 
DROP CONSTRAINT IF EXISTS reservations_pkey;

ALTER TABLE tours 
DROP CONSTRAINT IF EXISTS tours_pkey;

-- 4. 컬럼 타입 변경
-- customers 테이블 id 컬럼 타입 변경
ALTER TABLE customers 
ALTER COLUMN id TYPE text;

-- reservations 테이블 id 컬럼 타입 변경
ALTER TABLE reservations 
ALTER COLUMN id TYPE text;

-- reservations 테이블 customer_id 컬럼 타입 변경 (존재하는 경우에만)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE reservations ALTER COLUMN customer_id TYPE text;
        RAISE NOTICE 'Changed customer_id column type to text';
    ELSE
        RAISE NOTICE 'customer_id column does not exist in reservations table';
    END IF;
END $$;

-- tours 테이블 id 컬럼 타입 변경
ALTER TABLE tours 
ALTER COLUMN id TYPE text;

-- 5. 기본 키 제약 조건 재설정
ALTER TABLE customers 
ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

ALTER TABLE reservations 
ADD CONSTRAINT reservations_pkey PRIMARY KEY (id);

ALTER TABLE tours 
ADD CONSTRAINT tours_pkey PRIMARY KEY (id);

-- 6. 외래 키 제약 조건 재설정 (customer_id가 존재하는 경우에만)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE reservations 
        ADD CONSTRAINT reservations_customer_id_fkey 
        FOREIGN KEY (customer_id) REFERENCES customers(id);
        RAISE NOTICE 'Recreated customer_id foreign key constraint';
    ELSE
        RAISE NOTICE 'Skipping customer_id foreign key constraint (column does not exist)';
    END IF;
END $$;
