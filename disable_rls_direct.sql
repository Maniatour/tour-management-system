-- product_details 테이블의 RLS를 일시적으로 비활성화
ALTER TABLE public.product_details DISABLE ROW LEVEL SECURITY;

-- RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'product_details';

-- 정책 확인 (비활성화 후에는 없어야 함)
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
WHERE tablename = 'product_details';
