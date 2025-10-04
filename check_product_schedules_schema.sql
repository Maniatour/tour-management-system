-- product_schedules 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'product_schedules' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 테이블 존재 여부 확인
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_name = 'product_schedules' 
    AND table_schema = 'public'
) as table_exists;
