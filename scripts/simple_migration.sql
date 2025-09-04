-- 간단한 마이그레이션 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. MDGCSUNRISE 상품 생성
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

-- 4. 간단한 마이그레이션 함수 생성
CREATE OR REPLACE FUNCTION migrate_product_ids_simple()
RETURNS TABLE(
    old_product_id TEXT,
    new_product_id TEXT,
    option_name TEXT,
    updated_count INTEGER
) AS $$
DECLARE
    lower_canyon_option_id UUID;
    x_canyon_option_id UUID;
    updated_count INTEGER;
BEGIN
    -- 옵션 ID 조회
    SELECT id INTO lower_canyon_option_id
    FROM product_options 
    WHERE product_id = 'MDGCSUNRISE' 
    AND name = 'Lower Antelope Canyon'
    AND is_required = true
    LIMIT 1;
    
    SELECT id INTO x_canyon_option_id
    FROM product_options 
    WHERE product_id = 'MDGCSUNRISE' 
    AND name = 'Antelope X Canyon'
    AND is_required = true
    LIMIT 1;
    
    -- MDGCSUNRISE_X를 MDGCSUNRISE로 변경
    UPDATE reservations 
    SET product_id = 'MDGCSUNRISE'
    WHERE product_id = 'MDGCSUNRISE_X';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN QUERY SELECT 'MDGCSUNRISE_X'::TEXT, 'MDGCSUNRISE'::TEXT, 'Antelope X Canyon'::TEXT, updated_count;
    
    -- MDGCSUNRISE_X에서 변경된 예약들에 Antelope X Canyon 옵션 추가
    IF x_canyon_option_id IS NOT NULL THEN
        UPDATE reservations 
        SET selected_options = COALESCE(selected_options, '{}'::jsonb) || 
            jsonb_build_object(x_canyon_option_id::text, jsonb_build_array())
        WHERE product_id = 'MDGCSUNRISE' 
        AND (selected_options IS NULL OR selected_options = '{}'::jsonb);
    END IF;
    
    -- 기존 MDGCSUNRISE에 Lower Antelope Canyon 옵션 추가
    IF lower_canyon_option_id IS NOT NULL THEN
        UPDATE reservations 
        SET selected_options = COALESCE(selected_options, '{}'::jsonb) || 
            jsonb_build_object(lower_canyon_option_id::text, jsonb_build_array())
        WHERE product_id = 'MDGCSUNRISE' 
        AND (selected_options IS NULL OR selected_options = '{}'::jsonb)
        AND NOT (selected_options ? lower_canyon_option_id::text);
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSE
        updated_count := 0;
    END IF;
    
    RETURN QUERY SELECT 'MDGCSUNRISE'::TEXT, 'MDGCSUNRISE'::TEXT, 'Lower Antelope Canyon'::TEXT, updated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 결과 확인
SELECT '=== 상품 옵션 확인 ===' as status;
SELECT 
    po.id,
    po.product_id,
    po.name,
    po.is_required,
    p.name as product_name
FROM product_options po
JOIN products p ON p.id = po.product_id
WHERE po.product_id = 'MDGCSUNRISE'
AND po.name IN ('Lower Antelope Canyon', 'Antelope X Canyon')
ORDER BY po.name;

-- 6. 현재 예약 데이터 현황
SELECT '=== 현재 예약 데이터 현황 ===' as status;
SELECT 
    product_id,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN selected_options IS NULL OR selected_options = '{}'::jsonb THEN 1 END) as no_options,
    COUNT(CASE WHEN selected_options IS NOT NULL AND selected_options != '{}'::jsonb THEN 1 END) as has_options
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X')
GROUP BY product_id
ORDER BY product_id;
