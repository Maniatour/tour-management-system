-- 14일 이상 지난 투어의 채팅방을 일괄 비활성화
-- 실행 날짜: 2025-02-XX
-- 설명: 오늘 날짜 기준으로 tour_date가 14일 이상 지난 투어의 채팅방을 is_active = false로 변경

-- 1. 먼저 변경될 채팅방 확인 (실행 전 확인용)
SELECT 
  cr.id as chat_room_id,
  cr.room_name,
  cr.is_active,
  t.id as tour_id,
  t.tour_date,
  CURRENT_DATE - t.tour_date as days_passed
FROM chat_rooms cr
INNER JOIN tours t ON cr.tour_id = t.id
WHERE 
  cr.is_active = true
  AND t.tour_date IS NOT NULL
  AND t.tour_date < (CURRENT_DATE - INTERVAL '14 days')
ORDER BY t.tour_date DESC;

-- 2. 실제 업데이트 실행
UPDATE chat_rooms
SET 
  is_active = false,
  updated_at = NOW()
WHERE id IN (
  SELECT cr.id
  FROM chat_rooms cr
  INNER JOIN tours t ON cr.tour_id = t.id
  WHERE 
    cr.is_active = true
    AND t.tour_date IS NOT NULL
    AND t.tour_date < (CURRENT_DATE - INTERVAL '14 days')
);

-- 3. 변경된 채팅방 수 확인
SELECT 
  COUNT(*) as deactivated_count,
  '채팅방이 비활성화되었습니다.' as message
FROM chat_rooms cr
INNER JOIN tours t ON cr.tour_id = t.id
WHERE 
  cr.is_active = false
  AND t.tour_date IS NOT NULL
  AND t.tour_date < (CURRENT_DATE - INTERVAL '14 days');
