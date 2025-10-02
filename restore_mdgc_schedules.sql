-- MDGCSUNRISE 상품의 product_schedules 데이터 복구 스크립트
-- 밤도깨비 투어 일정 복구

-- 1. 현재 상태 확인
SELECT '=== 현재 MDGCSUNRISE 상품 상태 ===' as status;
SELECT id, name, name_ko, name_en, category, status FROM products WHERE id = 'MDGCSUNRISE';

SELECT '=== 현재 MDGCSUNRISE 일정 데이터 ===' as status;
SELECT COUNT(*) as schedule_count FROM product_schedules WHERE product_id = 'MDGCSUNRISE';

-- 2. MDGCSUNRISE 상품이 존재하지 않으면 생성
INSERT INTO products (id, name, name_ko, name_en, category, description, base_price, status, created_at, updated_at)
VALUES (
    'MDGCSUNRISE',
    '도깨비 투어',
    '도깨비 투어', 
    'Goblin Tour',
    '투어',
    'Lower Antelope Canyon과 Antelope X Canyon을 포함한 도깨비 투어',
    0.00,
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_ko = EXCLUDED.name_ko,
    name_en = EXCLUDED.name_en,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 3. MDGCSUNRISE 상품의 일정 데이터 복구 (새로운 스키마에 맞게)
-- 기존 데이터가 있다면 삭제
DELETE FROM product_schedules WHERE product_id = 'MDGCSUNRISE';

-- 새로운 일정 데이터 삽입 (새로운 스키마 구조에 맞게)
INSERT INTO product_schedules (
    product_id,
    day_number,
    start_time,
    end_time,
    duration_minutes,
    is_break,
    is_meal,
    is_transport,
    is_tour,
    latitude,
    longitude,
    show_to_customers,
    title_ko,
    title_en,
    description_ko,
    description_en,
    location_ko,
    location_en,
    guide_notes_ko,
    guide_notes_en,
    thumbnail_url,
    order_index,
    two_guide_schedule,
    guide_driver_schedule,
    created_at,
    updated_at
) VALUES 
-- 1일차 일정
('MDGCSUNRISE', 1, '05:00:00', '06:00:00', 60, false, false, true, false, null, null, true, '라스베가스 출발', 'Departure from Las Vegas', '라스베가스에서 투어 시작', 'Tour starts from Las Vegas', '라스베가스', 'Las Vegas', '새벽 출발로 고객들에게 미리 안내', 'Early departure - inform customers in advance', null, 1, 'guide', 'guide', NOW(), NOW()),

('MDGCSUNRISE', 1, '06:00:00', '10:00:00', 240, false, false, true, false, null, null, true, '페이지 이동', 'Travel to Page', '라스베가스에서 페이지까지 이동', 'Travel from Las Vegas to Page', '페이지', 'Page', '운전 중 휴식 시간 고려', 'Consider rest time during driving', null, 2, 'guide', 'assistant', NOW(), NOW()),

('MDGCSUNRISE', 1, '10:00:00', '10:30:00', 30, true, false, false, false, null, null, true, '휴식 시간', 'Rest Time', '페이지 도착 후 휴식', 'Rest after arriving in Page', '페이지', 'Page', '화장실 이용 및 준비 시간', 'Restroom break and preparation time', null, 3, null, null, NOW(), NOW()),

('MDGCSUNRISE', 1, '10:30:00', '12:30:00', 120, false, false, false, true, null, null, true, 'Lower Antelope Canyon 투어', 'Lower Antelope Canyon Tour', '로어 앤텔로프 캐년 투어', 'Lower Antelope Canyon tour', '로어 앤텔로프 캐년', 'Lower Antelope Canyon', '사진 촬영 포인트 안내', 'Guide photo shooting points', null, 4, 'guide', 'guide', NOW(), NOW()),

('MDGCSUNRISE', 1, '12:30:00', '13:30:00', 60, false, true, false, false, null, null, true, '점심 식사', 'Lunch', '페이지에서 점심 식사', 'Lunch in Page', '페이지', 'Page', '로컬 레스토랑 추천', 'Recommend local restaurants', null, 5, null, null, NOW(), NOW()),

('MDGCSUNRISE', 1, '13:30:00', '15:30:00', 120, false, false, false, true, null, null, true, 'Antelope X Canyon 투어', 'Antelope X Canyon Tour', '앤텔로프 X 캐년 투어', 'Antelope X Canyon tour', '앤텔로프 X 캐년', 'Antelope X Canyon', '사진 촬영 포인트 안내', 'Guide photo shooting points', null, 6, 'guide', 'guide', NOW(), NOW()),

('MDGCSUNRISE', 1, '15:30:00', '19:30:00', 240, false, false, true, false, null, null, true, '라스베가스 복귀', 'Return to Las Vegas', '페이지에서 라스베가스로 복귀', 'Return from Page to Las Vegas', '라스베가스', 'Las Vegas', '운전 중 휴식 시간 고려', 'Consider rest time during driving', null, 7, 'guide', 'assistant', NOW(), NOW()),

('MDGCSUNRISE', 1, '19:30:00', '20:00:00', 30, true, false, false, false, null, null, true, '투어 종료', 'Tour End', '라스베가스 도착 후 투어 종료', 'Tour ends after arriving in Las Vegas', '라스베가스', 'Las Vegas', '고객들에게 다음 일정 안내', 'Inform customers about next schedule', null, 8, null, null, NOW(), NOW());

-- 4. 복구 결과 확인
SELECT '=== 복구된 일정 데이터 ===' as status;
SELECT 
    day_number,
    start_time,
    end_time,
    title_ko,
    location_ko,
    two_guide_schedule,
    guide_driver_schedule,
    order_index
FROM product_schedules 
WHERE product_id = 'MDGCSUNRISE'
ORDER BY day_number, order_index;

-- 5. 일정 통계 확인
SELECT '=== 일정 통계 ===' as status;
SELECT 
    COUNT(*) as total_schedules,
    COUNT(CASE WHEN is_transport = true THEN 1 END) as transport_schedules,
    COUNT(CASE WHEN is_tour = true THEN 1 END) as tour_schedules,
    COUNT(CASE WHEN is_meal = true THEN 1 END) as meal_schedules,
    COUNT(CASE WHEN is_break = true THEN 1 END) as break_schedules
FROM product_schedules 
WHERE product_id = 'MDGCSUNRISE';

-- 6. 가이드 할당 통계
SELECT '=== 가이드 할당 통계 ===' as status;
SELECT 
    two_guide_schedule,
    guide_driver_schedule,
    COUNT(*) as count
FROM product_schedules 
WHERE product_id = 'MDGCSUNRISE'
GROUP BY two_guide_schedule, guide_driver_schedule
ORDER BY count DESC;
