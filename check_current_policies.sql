-- 현재 product_details 테이블의 RLS 상태와 정책 확인

-- 1) RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'product_details';

-- 2) 현재 정책 확인
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

-- 3) 현재 사용자 정보 확인
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as email,
  public.current_email() as current_email,
  public.is_staff(public.current_email()) as is_staff;

-- 4) team 테이블에서 현재 사용자 확인
SELECT 
  email,
  is_active,
  position
FROM public.team 
WHERE lower(email) = lower(public.current_email());
