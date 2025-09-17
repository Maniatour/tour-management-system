-- 일시적으로 RLS 비활성화 (테스트용)
-- 주의: 프로덕션에서는 보안상 위험할 수 있음

-- RLS 비활성화
ALTER TABLE product_details DISABLE ROW LEVEL SECURITY;

-- 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'product_details';
