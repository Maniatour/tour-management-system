-- 모든 사용자 상태 확인 SQL
-- jameshan82@gmail.com과 wooyong.shim09@gmail.com 문제 진단

BEGIN;

-- 1. team 테이블에서 두 사용자 모두 확인
SELECT 'All users in team table:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status,
    created_at
FROM team 
WHERE email IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
ORDER BY email;

-- 2. 역할 결정 로직 확인
SELECT 'Role determination for both users:' as info;
SELECT 
    email,
    name_ko,
    position,
    CASE 
        WHEN LOWER(email) IN ('info@maniatour.com', 'wooyong.shim09@gmail.com') THEN 'super_admin'
        ELSE 'regular_user'
    END as admin_status,
    CASE 
        WHEN LOWER(position) = 'super' THEN 'admin'
        WHEN LOWER(position) = 'office manager' THEN 'manager'
        WHEN LOWER(position) IN ('tour guide', 'tourguide', 'guide', 'driver') THEN 'team_member'
        WHEN LOWER(position) = 'op' THEN 'admin'
        WHEN position IS NOT NULL AND position != '' THEN 'admin'
        ELSE 'customer'
    END as determined_role,
    is_active,
    CASE 
        WHEN is_active = true THEN 'active'
        ELSE 'inactive'
    END as status
FROM team 
WHERE email IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
ORDER BY email;

-- 3. 외래키 참조 상태 확인
SELECT 'Foreign key references:' as info;
SELECT 'Tours as guide:' as ref_type, COUNT(*) as count
FROM tours 
WHERE tour_guide_id IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
UNION ALL
SELECT 'Tours as assistant:' as ref_type, COUNT(*) as count
FROM tours 
WHERE assistant_id IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
UNION ALL
SELECT 'Off schedules:' as ref_type, COUNT(*) as count
FROM off_schedules 
WHERE team_email IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
UNION ALL
SELECT 'Off schedules approved by:' as ref_type, COUNT(*) as count
FROM off_schedules 
WHERE approved_by IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com');

COMMIT;
