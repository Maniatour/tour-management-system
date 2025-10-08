-- team 테이블 접근 권한 문제 해결
-- 406 오류는 RLS 정책으로 인해 team 테이블에 접근할 수 없어서 발생

-- 1. 현재 team 테이블 상태 확인
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status
FROM team 
WHERE email ILIKE '%kevinjung68%'
ORDER BY created_at;

-- 2. team 테이블 RLS 정책 확인
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename = 'team'
ORDER BY policyname;

-- 3. 현재 인증된 사용자 확인
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as jwt_email,
  auth.jwt() ->> 'sub' as jwt_sub,
  now() as current_time;

-- 4. 임시 해결책: team 테이블 RLS 정책을 더 관대하게 수정
-- (개발/테스트 환경에서만 사용, 프로덕션에서는 신중하게 적용)

-- 기존 정책 삭제
DROP POLICY IF EXISTS "team_select_all" ON public.team;
DROP POLICY IF EXISTS "team_modify_staff_only" ON public.team;

-- 새로운 정책 생성 (모든 인증된 사용자가 읽기 가능)
CREATE POLICY "team_select_authenticated" ON public.team
  FOR SELECT
  TO authenticated
  USING (true);

-- staff만 수정 가능
CREATE POLICY "team_modify_staff_only" ON public.team
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
      AND t.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team t
      WHERE lower(t.email) = lower(auth.jwt() ->> 'email')
      AND t.is_active = true
    )
  );

-- 5. Kevinjung68@gmail.com 사용자를 team 테이블에 추가 (없는 경우)
INSERT INTO team (name_ko, name_en, email, phone, position, department, role, is_active, status)
VALUES (
  'Kevin Jung',
  'Kevin Jung',
  'kevinjung68@gmail.com',
  '010-0000-0000',
  'Developer',
  'IT',
  'member',
  true,
  'active'
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  status = 'active',
  updated_at = NOW();

-- 6. 대안: team 테이블 RLS를 완전히 비활성화 (임시 해결책)
-- 주의: 보안상 권장되지 않음, 개발 환경에서만 사용
-- ALTER TABLE public.team DISABLE ROW LEVEL SECURITY;

-- 7. 확인 쿼리
SELECT 
  'RLS Status' as check_type,
  CASE 
    WHEN relrowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'team';

-- 8. team 테이블 접근 테스트
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active
FROM team 
WHERE email = 'kevinjung68@gmail.com';

