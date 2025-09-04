-- 수정된 상품 옵션 설정 마이그레이션
-- products 테이블 구조에 맞게 수정

-- 1. MDGCSUNRISE 상품이 존재하는지 확인하고 없으면 생성
INSERT INTO products (id, name, name_en, name_ko, category, description, base_price, status)
VALUES (
    'MDGCSUNRISE',
    '도깨비 투어',
    'Goblin Tour',
    '도깨비 투어',
    '투어',
    'Lower Antelope Canyon과 Antelope X Canyon을 포함한 도깨비 투어',
    0.00,
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    name_en = EXCLUDED.name_en,
    name_ko = EXCLUDED.name_ko,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    base_price = EXCLUDED.base_price,
    status = EXCLUDED.status;

-- 2. Lower Antelope Canyon 필수 옵션 생성
INSERT INTO product_options (id, product_id, name, description, is_required, is_multiple, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'MDGCSUNRISE',
    'Lower Antelope Canyon',
    'Lower Antelope Canyon 투어 옵션',
    true,
    false,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- 3. Antelope X Canyon 필수 옵션 생성
INSERT INTO product_options (id, product_id, name, description, is_required, is_multiple, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'MDGCSUNRISE',
    'Antelope X Canyon',
    'Antelope X Canyon 투어 옵션',
    true,
    false,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING;

-- 4. 옵션 생성 결과 확인을 위한 뷰
CREATE OR REPLACE VIEW product_options_check AS
SELECT 
    po.id,
    po.product_id,
    po.name,
    po.is_required,
    po.is_multiple,
    p.name as product_name
FROM product_options po
JOIN products p ON p.id = po.product_id
WHERE po.product_id = 'MDGCSUNRISE'
AND po.name IN ('Lower Antelope Canyon', 'Antelope X Canyon')
ORDER BY po.name;

-- 5. 현재 예약 데이터 현황 확인을 위한 뷰
CREATE OR REPLACE VIEW current_reservation_status AS
SELECT 
    product_id,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN selected_options IS NULL OR selected_options = '{}'::jsonb THEN 1 END) as no_options,
    COUNT(CASE WHEN selected_options IS NOT NULL AND selected_options != '{}'::jsonb THEN 1 END) as has_options
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X')
GROUP BY product_id
ORDER BY product_id;
