-- document_templates 테이블 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  hasrls
FROM pg_tables 
WHERE tablename = 'document_templates';

-- RLS 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'document_templates';

-- 테이블 권한 확인
SELECT 
  table_name,
  privilege_type,
  grantee,
  is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'document_templates';

-- 현재 사용자 확인
SELECT current_user, session_user;
