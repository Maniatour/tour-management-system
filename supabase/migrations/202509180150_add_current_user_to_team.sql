-- Add current user to team table if not exists
-- This ensures the user can access team board features

INSERT INTO public.team (name_ko, name_en, email, phone, position, department, role, is_active)
VALUES (
  '관리자',
  'Admin',
  'info@maniatour.com',
  '010-0000-0000',
  'admin',
  '관리팀',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  is_active = true,
  position = 'admin',
  role = 'admin',
  updated_at = now();
