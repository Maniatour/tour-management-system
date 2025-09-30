-- Check current structure of op_todos table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'op_todos' 
ORDER BY ordinal_position;

