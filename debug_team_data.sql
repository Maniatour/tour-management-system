-- team 테이블 데이터 확인 및 디버깅
-- 팀 구성에서 0명 로드되는 문제 해결

-- 1. team 테이블 구조 확인
SELECT 'Team table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team' 
ORDER BY ordinal_position;

-- 2. team 테이블 전체 데이터 확인
SELECT 'All team data:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status,
  created_at
FROM team 
ORDER BY created_at;

-- 3. 활성 팀 멤버만 확인
SELECT 'Active team members:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active
FROM team 
WHERE is_active = true
ORDER BY position, name_ko;

-- 4. position별 멤버 수 확인
SELECT 'Members by position:' as info;
SELECT 
  position,
  COUNT(*) as member_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM team 
GROUP BY position
ORDER BY position;

-- 5. tour guide와 driver 포지션 확인 (대소문자 무시)
SELECT 'Tour guide and driver positions:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active
FROM team 
WHERE is_active = true
  AND (
    LOWER(position) LIKE '%tour%guide%' OR
    LOWER(position) LIKE '%guide%' OR
    LOWER(position) LIKE '%가이드%' OR
    LOWER(position) LIKE '%driver%' OR
    LOWER(position) LIKE '%드라이버%' OR
    LOWER(position) LIKE '%운전%'
  )
ORDER BY position, name_ko;

-- 6. RPC 함수 테스트
SELECT 'Testing RPC functions:' as info;

-- 개별 사용자 조회 테스트
SELECT 'get_team_member_info test:' as test;
SELECT * FROM public.get_team_member_info('kevinjung68@gmail.com');

-- 모든 활성 멤버 조회 테스트 (빈 배열로 모든 멤버 조회)
SELECT 'get_team_members_info test (empty array):' as test;
SELECT * FROM public.get_team_members_info(ARRAY[]::text[]);

-- 7. RLS 정책 확인
SELECT 'RLS policies:' as info;
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'team'
ORDER BY policyname;

-- 8. 현재 사용자 확인
SELECT 'Current user info:' as info;
SELECT 
  auth.uid() as user_id,
  auth.jwt() ->> 'email' as jwt_email,
  now() as current_time;
