-- 현재 team 테이블 데이터 확인
SELECT 'Current team table data:' as info;

-- 1. team 테이블 구조 확인
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'team' 
ORDER BY ordinal_position;

-- 2. team 데이터 확인
SELECT 
  email, 
  name_ko, 
  name_en, 
  position, 
  is_active,
  status,
  created_at
FROM team 
ORDER BY created_at;

-- 3. position별 사용자 수 확인
SELECT 
  position,
  COUNT(*) as user_count,
  COUNT(CASE WHEN is_active = true THEN 1 END) as active_count
FROM team 
GROUP BY position
ORDER BY position;

-- 4. admin 접근 가능한 사용자 확인
SELECT 
  email,
  name_ko,
  position,
  is_active,
  CASE 
    WHEN LOWER(position) = 'super' THEN 'admin'
    WHEN LOWER(position) = 'office manager' THEN 'manager'
    WHEN LOWER(position) IN ('tour guide', 'op', 'driver') THEN 'team_member'
    ELSE 'customer'
  END as user_role
FROM team 
WHERE is_active = true
ORDER BY 
  CASE 
    WHEN LOWER(position) = 'super' THEN 1
    WHEN LOWER(position) = 'office manager' THEN 2
    WHEN LOWER(position) IN ('tour guide', 'op', 'driver') THEN 3
    ELSE 4
  END,
  email;
