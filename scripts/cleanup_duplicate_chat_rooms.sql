-- 중복된 채팅룸 정리 스크립트
-- Migration: cleanup_duplicate_chat_rooms

-- 1. 각 투어별로 가장 최근에 생성된 채팅룸만 남기고 나머지 삭제
WITH ranked_rooms AS (
    SELECT 
        id,
        tour_id,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY tour_id ORDER BY created_at DESC) as rn
    FROM chat_rooms
    WHERE tour_id IS NOT NULL
)
DELETE FROM chat_rooms 
WHERE id IN (
    SELECT id 
    FROM ranked_rooms 
    WHERE rn > 1
);

-- 2. 정리 후 결과 확인
SELECT 
    'Cleaned up duplicate chat rooms' as status,
    COUNT(*) as remaining_rooms
FROM chat_rooms;

-- 3. 투어별 채팅룸 현황 확인
SELECT 
    t.id as tour_id,
    t.tour_date,
    p.name as product_name,
    t.tour_status,
    COUNT(cr.id) as chat_room_count,
    cr.room_code,
    cr.is_active,
    cr.created_at as chat_room_created
FROM tours t
LEFT JOIN products p ON t.product_id = p.id
LEFT JOIN chat_rooms cr ON t.id = cr.tour_id
WHERE t.tour_status IN ('Recruiting', 'Confirmed')
AND t.tour_date >= CURRENT_DATE
GROUP BY t.id, t.tour_date, p.name, t.tour_status, cr.room_code, cr.is_active, cr.created_at
ORDER BY t.tour_date ASC;
