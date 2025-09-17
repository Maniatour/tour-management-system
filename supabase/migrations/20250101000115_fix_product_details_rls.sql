-- product_details 테이블 RLS 정책 수정
-- 기존 정책을 삭제하고 새로 생성

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow all operations on product_details for authenticated users" ON product_details;
DROP POLICY IF EXISTS "Allow public read access to product_details" ON product_details;

-- 새로운 정책 생성
-- 1. 인증된 사용자에게 모든 작업 허용
CREATE POLICY "Enable all operations for authenticated users on product_details"
ON product_details FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. 공개 읽기 허용 (고객용)
CREATE POLICY "Enable read access for all users on product_details"
ON product_details FOR SELECT
TO anon
USING (true);

-- 3. 추가: team 테이블의 사용자에게만 쓰기 허용 (선택사항)
-- 이 정책은 team 테이블에 등록된 사용자만 쓰기를 허용합니다
CREATE POLICY "Enable write access for team members on product_details"
ON product_details FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team 
    WHERE team.email = auth.jwt() ->> 'email' 
    AND team.is_active = true
  )
);

CREATE POLICY "Enable update access for team members on product_details"
ON product_details FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team 
    WHERE team.email = auth.jwt() ->> 'email' 
    AND team.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM team 
    WHERE team.email = auth.jwt() ->> 'email' 
    AND team.is_active = true
  )
);

CREATE POLICY "Enable delete access for team members on product_details"
ON product_details FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM team 
    WHERE team.email = auth.jwt() ->> 'email' 
    AND team.is_active = true
  )
);

-- 정책 확인을 위한 쿼리
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
