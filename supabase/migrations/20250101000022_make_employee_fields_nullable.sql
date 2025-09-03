-- Make employee fields nullable except email, name_ko, and phone
-- This will make the form more flexible for new employee registration

-- Update employees table to make most fields nullable
-- Only email, name_ko, and phone will remain NOT NULL

DO $$ 
BEGIN
    RAISE NOTICE '=== Making employee fields nullable ===';
    
    -- Make name_en nullable
    ALTER TABLE employees ALTER COLUMN name_en DROP NOT NULL;
    RAISE NOTICE '✓ Made name_en nullable';
    
    -- Make language nullable
    ALTER TABLE employees ALTER COLUMN language DROP NOT NULL;
    RAISE NOTICE '✓ Made language nullable';
    
    -- Make type nullable
    ALTER TABLE employees ALTER COLUMN type DROP NOT NULL;
    RAISE NOTICE '✓ Made type nullable';
    
    -- Make emergency_contact nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN emergency_contact DROP NOT NULL;
    RAISE NOTICE '✓ Made emergency_contact nullable';
    
    -- Make is_active nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN is_active DROP NOT NULL;
    RAISE NOTICE '✓ Made is_active nullable';
    
    -- Make date_of_birth nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN date_of_birth DROP NOT NULL;
    RAISE NOTICE '✓ Made date_of_birth nullable';
    
    -- Make address nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN address DROP NOT NULL;
    RAISE NOTICE '✓ Made address nullable';
    
    -- Make ssn nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN ssn DROP NOT NULL;
    RAISE NOTICE '✓ Made ssn nullable';
    
    -- Make photo nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN photo DROP NOT NULL;
    RAISE NOTICE '✓ Made photo nullable';
    
    -- Make personal_car_model nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN personal_car_model DROP NOT NULL;
    RAISE NOTICE '✓ Made personal_car_model nullable';
    
    -- Make car_year nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN car_year DROP NOT NULL;
    RAISE NOTICE '✓ Made car_year nullable';
    
    -- Make car_plate nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN car_plate DROP NOT NULL;
    RAISE NOTICE '✓ Made car_plate nullable';
    
    -- Make bank_name nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN bank_name DROP NOT NULL;
    RAISE NOTICE '✓ Made bank_name nullable';
    
    -- Make account_holder nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN account_holder DROP NOT NULL;
    RAISE NOTICE '✓ Made account_holder nullable';
    
    -- Make bank_number nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN bank_number DROP NOT NULL;
    RAISE NOTICE '✓ Made bank_number nullable';
    
    -- Make routing_number nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN routing_number DROP NOT NULL;
    RAISE NOTICE '✓ Made routing_number nullable';
    
    -- Make cpr nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN cpr DROP NOT NULL;
    RAISE NOTICE '✓ Made cpr nullable';
    
    -- Make cpr_acquired nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN cpr_acquired DROP NOT NULL;
    RAISE NOTICE '✓ Made cpr_acquired nullable';
    
    -- Make cpr_expired nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN cpr_expired DROP NOT NULL;
    RAISE NOTICE '✓ Made cpr_expired nullable';
    
    -- Make medical_report nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN medical_report DROP NOT NULL;
    RAISE NOTICE '✓ Made medical_report nullable';
    
    -- Make medical_acquired nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN medical_acquired DROP NOT NULL;
    RAISE NOTICE '✓ Made medical_acquired nullable';
    
    -- Make medical_expired nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN medical_expired DROP NOT NULL;
    RAISE NOTICE '✓ Made medical_expired nullable';
    
    -- Make status nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN status DROP NOT NULL;
    RAISE NOTICE '✓ Made status nullable';
    
    -- Make created_at nullable (already nullable, but ensuring)
    ALTER TABLE employees ALTER COLUMN created_at DROP NOT NULL;
    RAISE NOTICE '✓ Made created_at nullable';
    
    RAISE NOTICE '=== All fields made nullable except email, name_ko, and phone ===';
END $$;

-- Verify the final structure
DO $$ 
DECLARE
    col RECORD;
BEGIN
    RAISE NOTICE '=== Final structure verification ===';
    
    -- Check which columns are NOT NULL
    RAISE NOTICE 'NOT NULL columns:';
    FOR col IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND is_nullable = 'NO'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (NOT NULL)', col.column_name, col.data_type;
    END LOOP;
    
    -- Check which columns are nullable
    RAISE NOTICE 'Nullable columns:';
    FOR col IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND is_nullable = 'YES'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  %: % (nullable)', col.column_name, col.data_type;
    END LOOP;
    
    RAISE NOTICE '=== Verification completed ===';
END $$;

-- Update table comment
COMMENT ON TABLE employees IS '직원 테이블 - email을 Primary Key로 사용, 필수 필드: email, name_ko, phone';
COMMENT ON COLUMN employees.email IS '직원 이메일 (Primary Key, 필수값)';
COMMENT ON COLUMN employees.name_ko IS '한국어 이름 (필수값)';
COMMENT ON COLUMN employees.phone IS '전화번호 (필수값)';
COMMENT ON COLUMN employees.name_en IS '영어 이름 (선택사항)';
COMMENT ON COLUMN employees.language IS '사용 언어 (선택사항)';
COMMENT ON COLUMN employees.type IS '직원 유형 (선택사항)';
COMMENT ON COLUMN employees.emergency_contact IS '비상연락처 (선택사항)';
COMMENT ON COLUMN employees.is_active IS '활성 상태 (선택사항)';
COMMENT ON COLUMN employees.date_of_birth IS '생년월일 (선택사항)';
COMMENT ON COLUMN employees.address IS '주소 (선택사항)';
COMMENT ON COLUMN employees.ssn IS '주민번호 (선택사항)';
COMMENT ON COLUMN employees.photo IS '사진 (선택사항)';
COMMENT ON COLUMN employees.personal_car_model IS '개인 차량 모델 (선택사항)';
COMMENT ON COLUMN employees.car_year IS '차량 연도 (선택사항)';
COMMENT ON COLUMN employees.car_plate IS '차량 번호판 (선택사항)';
COMMENT ON COLUMN employees.bank_name IS '은행명 (선택사항)';
COMMENT ON COLUMN employees.account_holder IS '계좌 소유자 (선택사항)';
COMMENT ON COLUMN employees.bank_number IS '계좌번호 (선택사항)';
COMMENT ON COLUMN employees.routing_number IS '라우팅 번호 (선택사항)';
COMMENT ON COLUMN employees.cpr IS 'CPR 자격 (선택사항)';
COMMENT ON COLUMN employees.cpr_acquired IS 'CPR 취득일 (선택사항)';
COMMENT ON COLUMN employees.cpr_expired IS 'CPR 만료일 (선택사항)';
COMMENT ON COLUMN employees.medical_report IS '의료 보고서 (선택사항)';
COMMENT ON COLUMN employees.medical_acquired IS '의료 보고서 취득일 (선택사항)';
COMMENT ON COLUMN employees.medical_expired IS '의료 보고서 만료일 (선택사항)';
COMMENT ON COLUMN employees.status IS '상태 (선택사항)';
COMMENT ON COLUMN employees.created_at IS '생성일 (선택사항)';
