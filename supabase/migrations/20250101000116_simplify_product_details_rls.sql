-- product_details 테이블 RLS 정책 단순화
-- 모든 정책을 삭제하고 가장 기본적인 정책만 생성

-- 모든 기존 정책 삭제
DROP POLICY IF EXISTS "Enable all operations for authenticated users on product_details" ON product_details;
DROP POLICY IF EXISTS "Enable read access for all users on product_details" ON product_details;
DROP POLICY IF EXISTS "Enable write access for team members on product_details" ON product_details;
DROP POLICY IF EXISTS "Enable update access for team members on product_details" ON product_details;
DROP POLICY IF EXISTS "Enable delete access for team members on product_details" ON product_details;

-- 가장 기본적인 정책만 생성
-- 1. 인증된 사용자에게 모든 작업 허용 (가장 단순한 형태)
CREATE POLICY "Allow all for authenticated users"
ON product_details FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. 익명 사용자에게 읽기 허용
CREATE POLICY "Allow read for anonymous users"
ON product_details FOR SELECT
TO anon
USING (true);

-- RLS가 활성화되어 있는지 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'product_details';

-- 정책 확인
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
WHERE tablename = 'product_details'
ORDER BY policyname;
