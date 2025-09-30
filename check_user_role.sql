-- 사용자 역할 확인 SQL
-- jameshan82@gmail.com 사용자의 현재 역할과 권한 확인

BEGIN;

-- 1. team 테이블에서 사용자 정보 확인
SELECT 'User info from team table:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status,
    created_at
FROM team 
WHERE email = 'jameshan82@gmail.com';

-- 2. 사용자 역할 결정 로직 확인
-- 코드에서 사용하는 역할 결정 로직을 SQL로 구현
SELECT 'Role determination:' as info;
SELECT 
    email,
    name_ko,
    position,
    CASE 
        WHEN LOWER(position) = 'super' THEN 'admin'
        WHEN LOWER(position) = 'office manager' THEN 'manager'
        WHEN LOWER(position) IN ('tour guide', 'op', 'driver') THEN 'team_member'
        WHEN position IS NOT NULL AND position != '' THEN 'team_member'
        ELSE 'customer'
    END as determined_role,
    is_active,
    CASE 
        WHEN is_active = true THEN 'active'
        ELSE 'inactive'
    END as status
FROM team 
WHERE email = 'jameshan82@gmail.com';

-- 3. 외래키 참조 상태 확인
SELECT 'Foreign key references:' as info;
SELECT 'Tours as guide:' as ref_type, COUNT(*) as count
FROM tours 
WHERE tour_guide_id = 'jameshan82@gmail.com'
UNION ALL
SELECT 'Tours as assistant:' as ref_type, COUNT(*) as count
FROM tours 
WHERE assistant_id = 'jameshan82@gmail.com'
UNION ALL
SELECT 'Off schedules:' as ref_type, COUNT(*) as count
FROM off_schedules 
WHERE team_email = 'jameshan82@gmail.com'
UNION ALL
SELECT 'Off schedules approved by:' as ref_type, COUNT(*) as count
FROM off_schedules 
WHERE approved_by = 'jameshan82@gmail.com';

-- 4. 슈퍼관리자 이메일 확인 (코드에서 하드코딩된 이메일들)
SELECT 'Super admin emails check:' as info;
SELECT 
    email,
    CASE 
        WHEN LOWER(email) IN ('jameshan82@gmail.com', 'admin@tour.com', 'super@tour.com') THEN 'super_admin'
        ELSE 'regular_user'
    END as admin_status
FROM team 
WHERE email = 'jameshan82@gmail.com';

COMMIT;
