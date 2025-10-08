-- reservation_options 테이블 상태 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservation_options' 
ORDER BY ordinal_position;

-- 테이블이 존재하는지 확인
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'reservation_options'
) as table_exists;

