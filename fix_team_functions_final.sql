-- team 테이블 접근 문제 해결 - 최종 안전한 버전
-- 404 오류 해결: get_team_member_info 함수가 존재하지 않음

-- 1. 기존 함수 삭제 (있는 경우)
DROP FUNCTION IF EXISTS public.get_team_member_info(TEXT);
DROP FUNCTION IF EXISTS public.get_team_members_info(TEXT[]);
DROP FUNCTION IF EXISTS public.is_current_user_team_member();

-- 2. team 테이블 접근을 위한 안전한 함수 생성
CREATE OR REPLACE FUNCTION public.get_team_member_info(p_email TEXT)
RETURNS TABLE(
  email TEXT,
  name_ko TEXT,
  name_en TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.email,
    t.name_ko,
    t.name_en,
    t.is_active
  FROM team t
  WHERE lower(t.email) = lower(p_email)
  AND t.is_active = true;
$$;

-- 3. 여러 이메일을 한 번에 조회하는 함수
CREATE OR REPLACE FUNCTION public.get_team_members_info(p_emails TEXT[])
RETURNS TABLE(
  email TEXT,
  name_ko TEXT,
  name_en TEXT,
  is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.email,
    t.name_ko,
    t.name_en,
    t.is_active
  FROM team t
  WHERE lower(t.email) = ANY(SELECT lower(unnest(p_emails)))
  AND t.is_active = true;
$$;

-- 4. 현재 사용자가 team 멤버인지 확인하는 함수
CREATE OR REPLACE FUNCTION public.is_current_user_team_member()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team t
    WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
    AND t.is_active = true
  );
$$;

-- 5. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.get_team_member_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members_info(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_team_member() TO authenticated;

-- 6. team 테이블 구조 확인
SELECT 'Checking team table structure...' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team' 
ORDER BY ordinal_position;

-- 7. 누락된 사용자 추가 (실제 team 테이블 구조에 맞춤)
INSERT INTO team (name_ko, name_en, email, phone, position, is_active, status)
VALUES 
  ('Kevin Jung', 'Kevin Jung', 'kevinjung68@gmail.com', '010-0000-0000', 'Developer', true, 'active'),
  ('Admin User', 'Admin User', 'admin@tour.com', '010-0000-0001', 'Admin', true, 'active')
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  status = 'active',
  updated_at = NOW();

-- 8. team 테이블 RLS 정책 확인 및 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "team_select_all" ON public.team;
DROP POLICY IF EXISTS "team_select_authenticated" ON public.team;
DROP POLICY IF EXISTS "team_select_authenticated_users" ON public.team;
DROP POLICY IF EXISTS "team_modify_staff_only" ON public.team;
DROP POLICY IF EXISTS "team_modify_members_only" ON public.team;

-- 새로운 정책 생성 - 모든 인증된 사용자가 읽기 가능
CREATE POLICY "team_select_authenticated_users" ON public.team
  FOR SELECT
  TO authenticated
  USING (true);

-- team 멤버만 수정 가능
CREATE POLICY "team_modify_members_only" ON public.team
  FOR ALL
  TO authenticated
  USING (public.is_current_user_team_member())
  WITH CHECK (public.is_current_user_team_member());

-- 9. 함수 테스트
SELECT 'Testing functions...' as test_message;

-- 개별 사용자 조회 테스트
SELECT 'Testing get_team_member_info...' as test;
SELECT * FROM public.get_team_member_info('kevinjung68@gmail.com');

-- 여러 사용자 조회 테스트
SELECT 'Testing get_team_members_info...' as test;
SELECT * FROM public.get_team_members_info(ARRAY['kevinjung68@gmail.com', 'admin@tour.com']);

-- 현재 사용자 확인 테스트
SELECT 'Testing is_current_user_team_member...' as test;
SELECT public.is_current_user_team_member() as is_team_member;

-- 10. team 테이블 데이터 확인
SELECT 'Current team data:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status
FROM team 
WHERE email IN ('kevinjung68@gmail.com', 'admin@tour.com')
ORDER BY created_at;

-- 11. RLS 상태 확인
SELECT 'RLS status:' as info;
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'team';

-- 12. 함수 존재 확인
SELECT 'Function verification:' as info;
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_team_member_info', 'get_team_members_info', 'is_current_user_team_member')
ORDER BY routine_name;

-- 13. 정책 확인
SELECT 'Policy verification:' as info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'team'
ORDER BY policyname;
