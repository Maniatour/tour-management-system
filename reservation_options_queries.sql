-- reservation_options 테이블 사용 예제 쿼리들

-- 1. 특정 예약의 모든 옵션 조회
SELECT 
    ro.id,
    ro.option_id,
    ro.ea,
    ro.price,
    ro.total_price,
    ro.status,
    ro.note,
    ro.created_at
FROM reservation_options ro
WHERE ro.reservation_id = 'your_reservation_id_here'
ORDER BY ro.created_at;

-- 2. 예약과 함께 옵션 정보 조회
SELECT 
    r.id as reservation_id,
    r.tour_date,
    r.adults,
    r.child,
    r.infant,
    r.total_people,
    ro.option_id,
    ro.ea,
    ro.price,
    ro.total_price,
    ro.status,
    ro.note
FROM reservations r
LEFT JOIN reservation_options ro ON r.id = ro.reservation_id
WHERE r.id = 'your_reservation_id_here'
ORDER BY ro.created_at;

-- 3. 특정 옵션의 모든 예약 조회
SELECT 
    ro.reservation_id,
    r.tour_date,
    r.adults,
    r.child,
    r.infant,
    ro.ea,
    ro.price,
    ro.total_price,
    ro.status
FROM reservation_options ro
JOIN reservations r ON ro.reservation_id = r.id
WHERE ro.option_id = 'your_option_id_here'
ORDER BY r.tour_date;

-- 4. 예약별 옵션 총합 계산
SELECT 
    r.id as reservation_id,
    r.tour_date,
    r.total_people,
    COUNT(ro.id) as option_count,
    SUM(ro.total_price) as total_option_price
FROM reservations r
LEFT JOIN reservation_options ro ON r.id = ro.reservation_id
WHERE ro.status = 'active'
GROUP BY r.id, r.tour_date, r.total_people
ORDER BY r.tour_date;

-- 5. 옵션별 통계
SELECT 
    ro.option_id,
    COUNT(*) as total_orders,
    SUM(ro.ea) as total_quantity,
    SUM(ro.total_price) as total_revenue,
    AVG(ro.price) as avg_price
FROM reservation_options ro
WHERE ro.status = 'active'
GROUP BY ro.option_id
ORDER BY total_revenue DESC;

-- 6. 특정 기간의 옵션 매출
SELECT 
    DATE(r.tour_date) as tour_date,
    ro.option_id,
    SUM(ro.ea) as total_quantity,
    SUM(ro.total_price) as daily_revenue
FROM reservation_options ro
JOIN reservations r ON ro.reservation_id = r.id
WHERE ro.status = 'active'
  AND r.tour_date >= '2024-01-01'
  AND r.tour_date <= '2024-12-31'
GROUP BY DATE(r.tour_date), ro.option_id
ORDER BY tour_date, daily_revenue DESC;

-- 7. 예약 옵션 추가 예제
INSERT INTO reservation_options (reservation_id, option_id, ea, price, status, note)
VALUES (
    'your_reservation_id_here',
    'option_001',
    2,
    50.00,
    'active',
    '추가 옵션 메모'
);

-- 8. 예약 옵션 업데이트 예제
UPDATE reservation_options 
SET 
    ea = 3,
    status = 'active',
    note = '수량 변경'
WHERE id = 'your_option_id_here';

-- 9. 예약 옵션 삭제 예제 (상태 변경)
UPDATE reservation_options 
SET status = 'cancelled'
WHERE id = 'your_option_id_here';

-- 10. 예약 옵션 완전 삭제
DELETE FROM reservation_options 
WHERE id = 'your_option_id_here';

