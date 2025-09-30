-- 두 사용자 모두 team 테이블에 추가/수정하는 SQL
-- jameshan82@gmail.com과 wooyong.shim09@gmail.com 문제 해결

BEGIN;

-- 1. 현재 team 테이블 상태 확인
SELECT 'Current team table status:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status
FROM team 
WHERE email IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
ORDER BY email;

-- 2. wooyong.shim09@gmail.com을 슈퍼관리자로 설정
INSERT INTO team (
    email, 
    name_ko, 
    name_en, 
    phone, 
    position, 
    is_active, 
    status,
    created_at,
    updated_at
)
VALUES (
    'wooyong.shim09@gmail.com', 
    '심우용', 
    'Woo Yong Shim', 
    '010-0000-0000', 
    'super', 
    true, 
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
    position = 'super',
    is_active = true,
    status = 'active',
    updated_at = NOW();

-- 3. jameshan82@gmail.com을 투어 가이드로 설정
INSERT INTO team (
    email, 
    name_ko, 
    name_en, 
    phone, 
    position, 
    is_active, 
    status,
    created_at,
    updated_at
)
VALUES (
    'jameshan82@gmail.com', 
    '제임스 한', 
    'James Han', 
    '010-0000-0000', 
    'tour guide', 
    true, 
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (email) 
DO UPDATE SET 
    position = 'tour guide',
    is_active = true,
    status = 'active',
    updated_at = NOW();

-- 4. 업데이트 후 확인
SELECT 'Updated team table status:' as info;
SELECT 
    email,
    name_ko,
    name_en,
    position,
    is_active,
    status,
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
    END as determined_role
FROM team 
WHERE email IN ('jameshan82@gmail.com', 'wooyong.shim09@gmail.com')
ORDER BY email;

COMMIT;
