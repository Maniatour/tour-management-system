-- 기존 team 테이블의 position과 is_active 컬럼을 사용하여 admin 설정
-- 이 스크립트를 Supabase SQL Editor에서 실행하세요

-- 1. 기존 사용자 중 하나를 Super(Admin)로 설정
-- (실제 사용할 이메일로 변경하세요)
UPDATE public.team 
SET 
  position = 'Super',  -- Super는 최고 관리자 역할
  is_active = true
WHERE email = 'your-admin-email@example.com';

-- 2. 새로운 Super 사용자 추가 (필요한 경우)
INSERT INTO public.team (
  email, 
  name_ko, 
  name_en, 
  phone, 
  position, 
  is_active,
  created_at
) VALUES (
  'admin@tour.com',  -- 실제 admin 이메일로 변경
  '관리자', 
  'Administrator', 
  '010-0000-0000', 
  'Super',  -- Super는 최고 관리자 역할
  true,     -- is_active = true
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  position = 'Super',
  is_active = true,
  updated_at = NOW();

-- 3. 다른 역할 예시 설정
-- Office Manager 설정 (Manager 역할)
UPDATE public.team 
SET position = 'Office Manager', is_active = true
WHERE email = 'manager@example.com';

-- Tour Guide 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'Tour Guide', is_active = true
WHERE email = 'guide@example.com';

-- OP 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'OP', is_active = true
WHERE email = 'op@example.com';

-- Driver 설정 (Team Member 역할)
UPDATE public.team 
SET position = 'Driver', is_active = true
WHERE email = 'driver@example.com';

-- 4. 현재 팀원 목록 확인
SELECT 
  email, 
  name_ko, 
  name_en, 
  position, 
  is_active,
  created_at
FROM public.team 
WHERE is_active = true
ORDER BY 
  CASE 
    WHEN position = 'Super' THEN 1
    WHEN position = 'Office Manager' THEN 2
    WHEN position IN ('Tour Guide', 'OP', 'Driver') THEN 3
    ELSE 4
  END,
  created_at;

-- 5. 역할별 사용자 수 확인
SELECT 
  CASE 
    WHEN position = 'Super' THEN 'Admin'
    WHEN position = 'Office Manager' THEN 'Manager'
    WHEN position IN ('Tour Guide', 'OP', 'Driver') THEN 'Team Member'
    WHEN position IS NOT NULL AND position != '' THEN 'Team Member'
    ELSE 'Customer'
  END as role,
  COUNT(*) as count
FROM public.team 
WHERE is_active = true
GROUP BY 
  CASE 
    WHEN position = 'Super' THEN 'Admin'
    WHEN position = 'Office Manager' THEN 'Manager'
    WHEN position IN ('Tour Guide', 'OP', 'Driver') THEN 'Team Member'
    WHEN position IS NOT NULL AND position != '' THEN 'Team Member'
    ELSE 'Customer'
  END;
