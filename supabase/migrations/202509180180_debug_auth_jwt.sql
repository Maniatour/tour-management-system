-- Debug auth.jwt() and RLS policies
-- 이 SQL을 실행하여 auth.jwt() 상태를 확인하세요

-- 1. 현재 인증된 사용자 확인
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as email,
  auth.role() as role,
  auth.jwt() as full_jwt;

-- 2. team 테이블에서 현재 사용자 확인
SELECT 
  email,
  name_ko,
  position,
  is_active
FROM team 
WHERE email = auth.jwt() ->> 'email';

-- 3. is_team_member 함수 테스트
SELECT 
  auth.jwt() ->> 'email' as email,
  public.is_team_member(auth.jwt() ->> 'email') as is_team_member_result;

-- 4. op_todos 테이블의 현재 정책 확인
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
WHERE tablename = 'op_todos';

-- 5. RLS가 활성화되어 있는지 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'op_todos';
