-- 기본 데이터 복구 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 기본 채널 데이터 생성
INSERT INTO channels (id, name, category, description, is_active, created_at, updated_at)
VALUES 
    ('direct', '직접 예약', 'direct', '웹사이트를 통한 직접 예약', true, NOW(), NOW()),
    ('phone', '전화 예약', 'phone', '전화를 통한 예약', true, NOW(), NOW()),
    ('email', '이메일 예약', 'email', '이메일을 통한 예약', true, NOW(), NOW()),
    ('walkin', '현장 예약', 'walkin', '현장에서의 직접 예약', true, NOW(), NOW()),
    ('booking_com', 'Booking.com', 'ota', 'Booking.com을 통한 예약', true, NOW(), NOW()),
    ('expedia', 'Expedia', 'ota', 'Expedia를 통한 예약', true, NOW(), NOW()),
    ('viator', 'Viator', 'ota', 'Viator를 통한 예약', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 2. 기본 상품 데이터 생성
INSERT INTO products (id, name, name_ko, name_en, category, description, base_price, status, created_at, updated_at)
VALUES 
    ('MDGC1D', '모뉴먼트 밸리 1일 투어', '모뉴먼트 밸리 1일 투어', 'Monument Valley 1-Day Tour', 'tour', '모뉴먼트 밸리 1일 투어', 150.00, 'active', NOW(), NOW()),
    ('MDGCSUNRISE', '도깨비 투어', '도깨비 투어', 'Goblin Tour', 'tour', 'Lower Antelope Canyon과 Antelope X Canyon을 포함한 도깨비 투어', 200.00, 'active', NOW(), NOW()),
    ('MDGC2D', '모뉴먼트 밸리 2일 투어', '모뉴먼트 밸리 2일 투어', 'Monument Valley 2-Day Tour', 'tour', '모뉴먼트 밸리 2일 투어', 300.00, 'active', NOW(), NOW()),
    ('MDGC3D', '모뉴먼트 밸리 3일 투어', '모뉴먼트 밸리 3일 투어', 'Monument Valley 3-Day Tour', 'tour', '모뉴먼트 밸리 3일 투어', 450.00, 'active', NOW(), NOW()),
    ('MDGC4D', '모뉴먼트 밸리 4일 투어', '모뉴먼트 밸리 4일 투어', 'Monument Valley 4-Day Tour', 'tour', '모뉴먼트 밸리 4일 투어', 600.00, 'active', NOW(), NOW()),
    ('MDGC5D', '모뉴먼트 밸리 5일 투어', '모뉴먼트 밸리 5일 투어', 'Monument Valley 5-Day Tour', 'tour', '모뉴먼트 밸리 5일 투어', 750.00, 'active', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_ko = EXCLUDED.name_ko,
    name_en = EXCLUDED.name_en,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 3. 기본 직원 데이터 생성
INSERT INTO employees (id, email, name_ko, name_en, language, type, phone, is_active, status, created_at)
VALUES 
    (gen_random_uuid(), 'guide1@example.com', '김가이드', 'Kim Guide', 'ko', 'guide', '010-1234-5678', true, 'active', NOW()),
    (gen_random_uuid(), 'guide2@example.com', '이가이드', 'Lee Guide', 'ko', 'guide', '010-2345-6789', true, 'active', NOW()),
    (gen_random_uuid(), 'driver1@example.com', '박드라이버', 'Park Driver', 'ko', 'driver', '010-3456-7890', true, 'active', NOW()),
    (gen_random_uuid(), 'admin@example.com', '관리자', 'Admin', 'ko', 'admin', '010-4567-8901', true, 'active', NOW())
ON CONFLICT (email) DO UPDATE SET
    name_ko = EXCLUDED.name_ko,
    name_en = EXCLUDED.name_en,
    language = EXCLUDED.language,
    type = EXCLUDED.type,
    phone = EXCLUDED.phone,
    is_active = EXCLUDED.is_active,
    status = EXCLUDED.status;

-- 4. 기본 상품 옵션 생성
INSERT INTO product_options (id, product_id, name, description, is_required, is_multiple, created_at, updated_at)
VALUES 
    -- MDGCSUNRISE 옵션
    (gen_random_uuid(), 'MDGCSUNRISE', 'Lower Antelope Canyon', 'Lower Antelope Canyon 투어 옵션', true, false, NOW(), NOW()),
    (gen_random_uuid(), 'MDGCSUNRISE', 'Antelope X Canyon', 'Antelope X Canyon 투어 옵션', true, false, NOW(), NOW()),
    -- MDGC1D 옵션
    (gen_random_uuid(), 'MDGC1D', '모뉴먼트 밸리 투어', '모뉴먼트 밸리 투어 옵션', true, false, NOW(), NOW()),
    (gen_random_uuid(), 'MDGC1D', '점심 식사', '점심 식사 옵션', false, false, NOW(), NOW()),
    -- MDGC2D 옵션
    (gen_random_uuid(), 'MDGC2D', '모뉴먼트 밸리 투어', '모뉴먼트 밸리 투어 옵션', true, false, NOW(), NOW()),
    (gen_random_uuid(), 'MDGC2D', '숙박', '숙박 옵션', true, false, NOW(), NOW()),
    (gen_random_uuid(), 'MDGC2D', '아침 식사', '아침 식사 옵션', false, false, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 5. 기본 픽업 호텔 데이터 생성
INSERT INTO pickup_hotels (id, hotel, location, address, is_active, created_at, updated_at)
VALUES 
    (gen_random_uuid(), '라스베가스 스트립 호텔', '라스베가스', '라스베가스 스트립', true, NOW(), NOW()),
    (gen_random_uuid(), '다운타운 라스베가스 호텔', '라스베가스', '다운타운 라스베가스', true, NOW(), NOW()),
    (gen_random_uuid(), '공항 근처 호텔', '라스베가스', '라스베가스 공항 근처', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- 6. 기본 차량 데이터 생성
INSERT INTO vehicles (id, vehicle_number, vehicle_type, make, model, year, color, license_plate, vehicle_status, vehicle_category, current_mileage, created_at, updated_at)
VALUES 
    (gen_random_uuid(), 'COMP001', 'SUV', 'Toyota', 'Highlander', 2022, 'White', 'NV-ABC123', '운행 가능', 'company', 25000, NOW(), NOW()),
    (gen_random_uuid(), 'COMP002', 'Van', 'Ford', 'Transit', 2021, 'Black', 'NV-DEF456', '운행 가능', 'company', 30000, NOW(), NOW()),
    (gen_random_uuid(), 'COMP003', 'SUV', 'Honda', 'Pilot', 2023, 'Silver', 'NV-GHI789', '운행 가능', 'company', 15000, NOW(), NOW())
ON CONFLICT (vehicle_number) DO UPDATE SET
    vehicle_type = EXCLUDED.vehicle_type,
    make = EXCLUDED.make,
    model = EXCLUDED.model,
    year = EXCLUDED.year,
    color = EXCLUDED.color,
    license_plate = EXCLUDED.license_plate,
    vehicle_status = EXCLUDED.vehicle_status,
    vehicle_category = EXCLUDED.vehicle_category,
    current_mileage = EXCLUDED.current_mileage,
    updated_at = NOW();

-- 7. 결과 확인
SELECT '=== 복구된 데이터 현황 ===' as status;

SELECT '채널' as table_name, COUNT(*) as count FROM channels
UNION ALL
SELECT '상품' as table_name, COUNT(*) as count FROM products
UNION ALL
SELECT '직원' as table_name, COUNT(*) as count FROM employees
UNION ALL
SELECT '상품옵션' as table_name, COUNT(*) as count FROM product_options
UNION ALL
SELECT '픽업호텔' as table_name, COUNT(*) as count FROM pickup_hotels
UNION ALL
SELECT '차량' as table_name, COUNT(*) as count FROM vehicles;
