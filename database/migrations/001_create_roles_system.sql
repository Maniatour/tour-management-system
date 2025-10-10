-- 사용자 역할 시스템 마이그레이션
-- 1단계: Roles 테이블 생성

-- 역할 테이블
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL, -- 'super_admin', 'admin', 'manager', 'staff', 'customer'
  display_name VARCHAR NOT NULL, -- '슈퍼 관리자', '관리자', '매니저', '직원', '고객'
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 권한 테이블
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL, -- 'can_view_admin', 'can_manage_users' 등
  display_name VARCHAR NOT NULL, -- '관리자 페이지 접근', '사용자 관리' 등
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 사용자-역할 연결 테이블
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, role_id)
);

-- 역할-권한 연결 테이블
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- 기본 역할들 삽입
INSERT INTO roles (name, display_name, description) VALUES
('super_admin', '슈퍼 관리자', '모든 권한을 가진 최고 관리자'),
('admin', '관리자', '시스템 관리 권한'),
('manager', '매니저', '팀 관리 권한'),
('staff', '직원', '기본 업무 권한'),
('customer', '고객', '일반 사용자 권한')
ON CONFLICT (name) DO NOTHING;

-- 기본 권한들 삽입
INSERT INTO permissions (name, display_name, description) VALUES
('can_view_admin', '관리자 페이지 접근', '관리자 페이지에 접근할 수 있는 권한'),
('can_manage_users', '사용자 관리', '사용자를 추가/수정/삭제할 수 있는 권한'),
('can_manage_products', '상품 관리', '상품을 관리할 수 있는 권한'),
('can_manage_customers', '고객 관리', '고객 정보를 관리할 수 있는 권한'),
('can_manage_reservations', '예약 관리', '예약을 관리할 수 있는 권한'),
('can_manage_tours', '투어 관리', '투어를 관리할 수 있는 권한'),
('can_manage_team', '팀 관리', '팀 멤버를 관리할 수 있는 권한'),
('can_view_schedule', '일정 조회', '일정을 조회할 수 있는 권한'),
('can_manage_bookings', '예약 관리', '예약을 관리할 수 있는 권한'),
('can_view_audit_logs', '감사 로그 조회', '감사 로그를 조회할 수 있는 권한'),
('can_manage_channels', '채널 관리', '채널을 관리할 수 있는 권한'),
('can_manage_options', '옵션 관리', '옵션을 관리할 수 있는 권한'),
('can_view_finance', '재무 조회', '재무 정보를 조회할 수 있는 권한')
ON CONFLICT (name) DO NOTHING;

-- 슈퍼 관리자: 모든 권한
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 관리자: 대부분 권한 (재무 조회 제외)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name IN (
  'can_view_admin', 'can_manage_users', 'can_manage_products', 
  'can_manage_customers', 'can_manage_reservations', 'can_manage_tours',
  'can_manage_team', 'can_view_schedule', 'can_manage_bookings',
  'can_view_audit_logs', 'can_manage_channels', 'can_manage_options'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 매니저: 제한된 관리 권한
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'manager' AND p.name IN (
  'can_view_admin', 'can_manage_customers', 'can_manage_reservations',
  'can_view_schedule', 'can_manage_bookings', 'can_manage_channels'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 직원: 기본 조회 권한
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'staff' AND p.name IN (
  'can_view_schedule', 'can_manage_bookings'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 고객: 기본 권한 없음 (기본값)
-- customer 역할은 별도 권한 없음

-- RLS 정책 설정
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- roles 테이블 정책 (모든 사용자가 읽기 가능)
CREATE POLICY "Anyone can read roles" ON roles FOR SELECT USING (true);

-- permissions 테이블 정책 (모든 사용자가 읽기 가능)
CREATE POLICY "Anyone can read permissions" ON permissions FOR SELECT USING (true);

-- user_roles 테이블 정책 (자신의 역할만 조회 가능)
CREATE POLICY "Users can read own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- role_permissions 테이블 정책 (모든 사용자가 읽기 가능)
CREATE POLICY "Anyone can read role_permissions" ON role_permissions FOR SELECT USING (true);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
