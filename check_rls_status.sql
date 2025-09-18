-- 현재 RLS 상태 및 정책 확인

-- 1. 모든 테이블의 RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('team', 'tours', 'reservations', 'customers', 'products', 'product_details', 'options', 'channels', 'audit_logs')
ORDER BY tablename;

-- 2. 모든 RLS 정책 확인
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
WHERE schemaname = 'public'
  AND tablename IN ('team', 'tours', 'reservations', 'customers', 'products', 'product_details', 'options', 'channels', 'audit_logs')
ORDER BY tablename, policyname;

-- 3. team 테이블 데이터 확인
SELECT 
  email,
  name_ko,
  position,
  is_active,
  status
FROM team 
ORDER BY created_at;

-- 4. 현재 인증된 사용자 정보 확인 (실행 시점에 로그인된 사용자)
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as jwt_email,
  auth.jwt() ->> 'sub' as jwt_sub,
  now() as current_time;
