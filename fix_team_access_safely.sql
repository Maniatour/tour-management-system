-- team 테이블 접근 문제 해결을 위한 안전한 방법
-- 406 오류 해결: RLS 정책으로 인한 team 테이블 접근 제한

-- 1. team 테이블 접근을 위한 안전한 함수 생성
CREATE OR REPLACE FUNCTION public.get_team_member_info(p_email TEXT)
RETURNS TABLE(
  email TEXT,
  name_ko TEXT,
  name_en TEXT,
  position TEXT,
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
    t.position,
    t.is_active
  FROM team t
  WHERE lower(t.email) = lower(p_email)
  AND t.is_active = true;
$$;

-- 2. 여러 이메일을 한 번에 조회하는 함수
CREATE OR REPLACE FUNCTION public.get_team_members_info(p_emails TEXT[])
RETURNS TABLE(
  email TEXT,
  name_ko TEXT,
  name_en TEXT,
  position TEXT,
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
    t.position,
    t.is_active
  FROM team t
  WHERE lower(t.email) = ANY(SELECT lower(unnest(p_emails)))
  AND t.is_active = true;
$$;

-- 3. 현재 사용자가 team 멤버인지 확인하는 함수
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

-- 4. team 테이블 RLS 정책을 더 유연하게 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "team_select_all" ON public.team;
DROP POLICY IF EXISTS "team_select_authenticated" ON public.team;
DROP POLICY IF EXISTS "team_modify_staff_only" ON public.team;

-- 새로운 정책 생성
-- 모든 인증된 사용자가 team 정보를 읽을 수 있도록 허용
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

-- 5. 누락된 사용자 추가 (필요한 경우)
INSERT INTO team (name_ko, name_en, email, phone, position, department, role, is_active, status)
VALUES 
  ('Kevin Jung', 'Kevin Jung', 'kevinjung68@gmail.com', '010-0000-0000', 'Developer', 'IT', 'member', true, 'active'),
  ('Admin User', 'Admin User', 'admin@tour.com', '010-0000-0001', 'Admin', 'Management', 'admin', true, 'active')
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  status = 'active',
  updated_at = NOW();

-- 6. 함수 권한 설정
GRANT EXECUTE ON FUNCTION public.get_team_member_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_members_info(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_team_member() TO authenticated;

-- 7. 테스트 쿼리
-- 개별 사용자 조회 테스트
SELECT * FROM public.get_team_member_info('kevinjung68@gmail.com');

-- 여러 사용자 조회 테스트
SELECT * FROM public.get_team_members_info(ARRAY['kevinjung68@gmail.com', 'admin@tour.com']);

-- 현재 사용자 확인 테스트
SELECT public.is_current_user_team_member() as is_team_member;

-- 8. 프론트엔드에서 사용할 수 있는 간단한 쿼리 예시
-- 기존: SELECT name_ko, name_en FROM team WHERE email = 'kevinjung68@gmail.com'
-- 새로운 방식: SELECT * FROM get_team_member_info('kevinjung68@gmail.com')

-- 9. RLS 상태 확인
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'team';

