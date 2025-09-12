-- 기존 투어 데이터로 채팅방 생성 스크립트
-- Migration: create_chat_rooms_for_tours

-- 1. Recruiting 또는 Confirmed 상태의 투어들에 대해 채팅방 생성
INSERT INTO chat_rooms (tour_id, room_name, room_code, description, is_active, created_by)
SELECT 
    t.id as tour_id,
    CONCAT('투어 채팅방 - ', COALESCE(p.name, '상품명 없음')) as room_name,
    UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6)) as room_code,
    CONCAT('투어 날짜: ', t.tour_date, ' - ', COALESCE(p.name, '상품명 없음'), ' 투어 관련 소통을 위한 채팅방입니다.') as description,
    true as is_active,
    'admin@kovegas.com' as created_by
FROM tours t
LEFT JOIN products p ON t.product_id = p.id
WHERE t.tour_status IN ('Recruiting', 'Confirmed')
AND NOT EXISTS (
    SELECT 1 FROM chat_rooms cr 
    WHERE cr.tour_id = t.id
);

-- 2. 생성된 채팅방 수 확인
SELECT 
    'Created chat rooms' as status,
    COUNT(*) as count
FROM chat_rooms cr
JOIN tours t ON cr.tour_id = t.id
WHERE t.tour_status IN ('Recruiting', 'Confirmed');

-- 3. 투어별 채팅방 현황 확인
SELECT 
    t.id as tour_id,
    t.tour_date,
    p.name as product_name,
    t.tour_status,
    cr.room_code,
    cr.is_active
FROM tours t
LEFT JOIN products p ON t.product_id = p.id
LEFT JOIN chat_rooms cr ON t.id = cr.tour_id
WHERE t.tour_status IN ('Recruiting', 'Confirmed')
ORDER BY t.tour_date DESC;

