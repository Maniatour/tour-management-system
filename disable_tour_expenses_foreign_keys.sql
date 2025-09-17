-- tour_expenses 테이블의 외래 키 제약 조건 일시 비활성화
-- 모든 레코드가 동기화되도록 하는 안전한 방법

BEGIN;

-- 1. 현재 외래 키 제약 조건 확인
SELECT 
    'Current foreign key constraints' as info,
    constraint_name,
    table_name,
    column_name,
    foreign_table_name,
    foreign_column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc 
    ON kcu.constraint_name = rc.constraint_name
WHERE kcu.table_name = 'tour_expenses'
AND kcu.column_name IN ('tour_id', 'product_id');

-- 2. 외래 키 제약 조건 일시 비활성화
ALTER TABLE tour_expenses DROP CONSTRAINT IF EXISTS tour_expenses_tour_id_fkey;
ALTER TABLE tour_expenses DROP CONSTRAINT IF EXISTS tour_expenses_product_id_fkey;

-- 3. 확인
SELECT 
    'Foreign keys disabled' as status,
    'tour_expenses table is now ready for sync without foreign key constraints' as message;

COMMIT;

-- 4. 동기화 후 복구를 위한 스크립트 (나중에 실행)
/*
-- 동기화 완료 후 외래 키 제약 조건 복구
BEGIN;
ALTER TABLE tour_expenses ADD CONSTRAINT tour_expenses_tour_id_fkey 
    FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE;
ALTER TABLE tour_expenses ADD CONSTRAINT tour_expenses_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
COMMIT;
*/
