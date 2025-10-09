-- document_templates 테이블 구조 확인
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'document_templates' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 테이블 제약조건 확인
SELECT 
    constraint_name,
    constraint_type,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'document_templates' 
AND tc.table_schema = 'public';

-- 현재 테이블의 데이터 확인
SELECT * FROM public.document_templates LIMIT 5;
