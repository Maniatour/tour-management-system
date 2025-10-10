-- info@maniatour.com 계정 확인 및 수정
-- super 계정으로 로그인했는데 고객으로 처리되는 문제 해결

-- 1. 현재 team 테이블에서 info@maniatour.com 계정 확인
SELECT 'Current info@maniatour.com account status:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status,
  created_at,
  updated_at
FROM team 
WHERE email = 'info@maniatour.com';

-- 2. team 테이블 전체 데이터 확인 (최근 10개)
SELECT 'Recent team members:' as info;
SELECT 
  email,
  name_ko,
  position,
  is_active,
  status,
  created_at
FROM team 
ORDER BY created_at DESC
LIMIT 10;

-- 3. info@maniatour.com 계정이 없다면 추가
INSERT INTO team (
  email, 
  name_ko, 
  name_en, 
  phone, 
  position, 
  languages, 
  is_active,
  status
) VALUES (
  'info@maniatour.com',
  '슈퍼 관리자',
  'Super Admin',
  '010-0000-0000',
  'super',
  ARRAY['ko', 'en'],
  true,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  position = 'super',
  is_active = true,
  name_ko = '슈퍼 관리자',
  name_en = 'Super Admin',
  status = 'active',
  updated_at = now();

-- 4. 수정 후 확인
SELECT 'Updated info@maniatour.com account:' as info;
SELECT 
  email,
  name_ko,
  name_en,
  position,
  is_active,
  status,
  updated_at
FROM team 
WHERE email = 'info@maniatour.com';

-- 5. 역할 결정 로직 테스트
SELECT 'Role determination test:' as info;
SELECT 
  email,
  position,
  CASE 
    WHEN LOWER(position) = 'super' THEN 'admin'
    WHEN LOWER(position) = 'office manager' THEN 'manager'
    WHEN LOWER(position) IN ('tour guide', 'tourguide', 'guide', 'driver') THEN 'team_member'
    WHEN LOWER(position) = 'op' THEN 'admin'
    WHEN position IS NOT NULL AND position != '' THEN 'admin'
    ELSE 'customer'
  END as determined_role
FROM team 
WHERE email = 'info@maniatour.com';
