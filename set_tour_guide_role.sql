-- jameshan82@gmail.com을 투어 가이드로 설정하는 SQL

BEGIN;

-- 1. 현재 상태 확인
SELECT 'Current user status:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status
FROM team 
WHERE email = 'jameshan82@gmail.com';

-- 2. 투어 가이드로 설정 (대소문자 구별 없음)
UPDATE team 
SET 
    position = 'tour guide',
    is_active = true,
    status = 'active'
WHERE email = 'jameshan82@gmail.com';

-- 3. 업데이트 후 확인
SELECT 'Updated user status:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status,
    CASE 
        WHEN LOWER(position) = 'super' THEN 'admin'
        WHEN LOWER(position) = 'office manager' THEN 'manager'
        WHEN LOWER(position) IN ('tour guide', 'tourguide', 'guide', 'op', 'driver') THEN 'team_member'
        WHEN position IS NOT NULL AND position != '' THEN 'team_member'
        ELSE 'customer'
    END as determined_role
FROM team 
WHERE email = 'jameshan82@gmail.com';

COMMIT;
