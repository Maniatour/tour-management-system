-- Admin 계정 설정 스크립트
-- team 테이블에 admin 계정을 추가하고 position을 설정합니다.

-- 1. 기존 team 테이블 확인
SELECT 'Current team table structure:' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team' 
ORDER BY ordinal_position;

-- 2. 기존 team 데이터 확인
SELECT 'Current team data:' as info;
SELECT email, name_ko, position, is_active 
FROM team 
ORDER BY created_at;

-- 3. Admin 계정 추가/업데이트
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
  'admin@tour.com',  -- 실제 admin 이메일로 변경하세요
  '관리자', 
  'Administrator', 
  '010-0000-0000', 
  'Super',  -- Super는 최고 관리자 역할
  ARRAY['ko', 'en'], 
  true,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  position = 'Super',
  is_active = true,
  name_ko = '관리자',
  name_en = 'Administrator',
  status = 'active';

-- 4. Manager 계정 추가/업데이트
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
  'manager@tour.com',  -- 실제 manager 이메일로 변경하세요
  '매니저', 
  'Manager', 
  '010-1111-1111', 
  'Office Manager',  -- Office Manager는 매니저 역할
  ARRAY['ko', 'en'], 
  true,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  position = 'Office Manager',
  is_active = true,
  name_ko = '매니저',
  name_en = 'Manager',
  status = 'active';

-- 5. 팀원 계정 추가/업데이트
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
  'guide@tour.com',  -- 실제 guide 이메일로 변경하세요
  '가이드', 
  'Guide', 
  '010-2222-2222', 
  'Tour Guide',  -- Tour Guide는 팀원 역할
  ARRAY['ko', 'en'], 
  true,
  'active'
) ON CONFLICT (email) DO UPDATE SET
  position = 'Tour Guide',
  is_active = true,
  name_ko = '가이드',
  name_en = 'Guide',
  status = 'active';

-- 6. 최종 확인
SELECT 'Final team data:' as info;
SELECT 
  email, 
  name_ko, 
  position, 
  is_active,
  status,
  created_at
FROM team 
WHERE is_active = true
ORDER BY 
  CASE position
    WHEN 'Super' THEN 1
    WHEN 'Office Manager' THEN 2
    WHEN 'Tour Guide' THEN 3
    WHEN 'OP' THEN 4
    WHEN 'Driver' THEN 5
    ELSE 6
  END,
  created_at;

-- 7. 역할별 권한 확인을 위한 함수 테스트
SELECT 'Role test results:' as info;
SELECT 
  email,
  position,
  CASE 
    WHEN LOWER(position) = 'super' THEN 'admin'
    WHEN LOWER(position) = 'office manager' THEN 'manager'
    WHEN LOWER(position) IN ('tour guide', 'op', 'driver') THEN 'team_member'
    ELSE 'customer'
  END as user_role
FROM team 
WHERE is_active = true
ORDER BY email;
