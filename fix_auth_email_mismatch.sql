-- 인증 이메일 불일치 문제 해결 SQL
-- Jameshan82@gmail.com을 jameshan82@gmail.com으로 변경 후 발생하는 404 오류 해결

BEGIN;

-- 1. 현재 team 테이블의 이메일 상태 확인
SELECT 'Current team table status:' as info;
SELECT email, name_ko, is_active FROM team WHERE email ILIKE '%jameshan82%';

-- 2. Supabase Auth 사용자 테이블 확인 (auth.users)
-- 주의: 이 쿼리는 Supabase 관리자 권한이 필요할 수 있습니다
SELECT 'Auth users table status:' as info;
SELECT email, email_confirmed_at, created_at, updated_at 
FROM auth.users 
WHERE email ILIKE '%jameshan82%';

-- 3. 만약 auth.users에 여전히 Jameshan82@gmail.com이 있다면
-- 새로운 이메일로 업데이트 (이 작업은 Supabase 대시보드에서 수동으로 해야 할 수 있음)
-- UPDATE auth.users 
-- SET email = 'jameshan82@gmail.com'
-- WHERE email = 'Jameshan82@gmail.com';

-- 4. team 테이블에서 이메일이 정확히 업데이트되었는지 확인
SELECT 'Team table after update:' as info;
SELECT email, name_ko, is_active FROM team WHERE email = 'jameshan82@gmail.com';

-- 5. 외래키 참조가 올바르게 업데이트되었는지 확인
SELECT 'Tours table references:' as info;
SELECT id, tour_guide_id, assistant_id FROM tours 
WHERE tour_guide_id = 'jameshan82@gmail.com' OR assistant_id = 'jameshan82@gmail.com';

SELECT 'Off schedules table references:' as info;
SELECT id, team_email, approved_by FROM off_schedules 
WHERE team_email = 'jameshan82@gmail.com' OR approved_by = 'jameshan82@gmail.com';

COMMIT;

-- 추가 해결 방법:
-- 1. 브라우저에서 완전히 로그아웃 후 다시 로그인
-- 2. 브라우저 캐시 및 쿠키 삭제
-- 3. Supabase 대시보드에서 auth.users 테이블 직접 확인 및 수정
-- 4. 필요시 새로운 계정으로 재가입
