-- product_details 테이블의 RLS를 일시적으로 비활성화
ALTER TABLE public.product_details DISABLE ROW LEVEL SECURITY;

-- RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'product_details';
