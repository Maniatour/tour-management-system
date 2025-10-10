-- 기존 team 테이블과 새로운 역할 시스템 연결
-- 2단계: team 테이블 마이그레이션

-- team 테이블에 role_id 컬럼 추가
ALTER TABLE team ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- 기존 position을 role로 마이그레이션
UPDATE team 
SET role_id = (
  SELECT id FROM roles WHERE name = CASE 
    WHEN position = 'admin' OR position = '관리자' THEN 'admin'
    WHEN position = 'manager' OR position = '매니저' THEN 'manager'
    WHEN position = 'staff' OR position = '직원' THEN 'staff'
    ELSE 'staff' -- 기본값
  END
)
WHERE role_id IS NULL;

-- 기존 사용자들을 user_roles 테이블에 추가
INSERT INTO user_roles (user_id, role_id)
SELECT 
  au.id as user_id,
  t.role_id
FROM team t
JOIN auth.users au ON au.email = t.email
WHERE t.is_active = true AND t.role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 슈퍼 관리자 이메일들을 user_roles에 추가
INSERT INTO user_roles (user_id, role_id)
SELECT 
  au.id as user_id,
  r.id as role_id
FROM auth.users au
JOIN roles r ON r.name = 'super_admin'
WHERE au.email IN (
  'info@maniatour.com',
  'admin@maniatour.com',
  'superadmin@maniatour.com'
)
ON CONFLICT (user_id, role_id) DO NOTHING;

-- team 테이블에 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_team_role_id ON team(role_id);
CREATE INDEX IF NOT EXISTS idx_team_email ON team(email);

-- 함수 생성: 이메일로 사용자 역할 조회
CREATE OR REPLACE FUNCTION get_user_role_by_email(user_email TEXT)
RETURNS TABLE(role_name TEXT, permissions TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.name as role_name,
    ARRAY_AGG(p.name) as permissions
  FROM user_roles ur
  JOIN roles r ON r.id = ur.role_id
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  LEFT JOIN permissions p ON p.id = rp.permission_id
  JOIN auth.users u ON u.id = ur.user_id
  WHERE u.email = user_email AND ur.is_active = true
  GROUP BY r.name;
END;
$$;

-- 함수 생성: 사용자 권한 확인
CREATE OR REPLACE FUNCTION has_user_permission(user_email TEXT, permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_permission BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    JOIN role_permissions rp ON rp.role_id = r.id
    JOIN permissions p ON p.id = rp.permission_id
    JOIN auth.users u ON u.id = ur.user_id
    WHERE u.email = user_email 
      AND ur.is_active = true 
      AND p.name = permission_name
  ) INTO has_permission;
  
  RETURN has_permission;
END;
$$;
