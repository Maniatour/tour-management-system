-- 테스트용 관리자 계정 설정

-- 1. team 테이블에 테스트 관리자 계정 추가
INSERT INTO team (email, name_ko, name_en, phone, position, is_active, status) VALUES
('admin@maniatour.com', '관리자', 'Admin', '010-0000-0000', 'super', true, 'active'),
('manager@maniatour.com', '매니저', 'Manager', '010-1111-1111', 'office manager', true, 'active'),
('guide@maniatour.com', '가이드', 'Guide', '010-2222-2222', 'tour guide', true, 'active'),
('op@maniatour.com', '운영자', 'Operator', '010-3333-3333', 'op', true, 'active'),
('driver@maniatour.com', '운전기사', 'Driver', '010-4444-4444', 'driver', true, 'active')
ON CONFLICT (email) DO UPDATE SET
  name_ko = EXCLUDED.name_ko,
  name_en = EXCLUDED.name_en,
  phone = EXCLUDED.phone,
  position = EXCLUDED.position,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  updated_at = now();
