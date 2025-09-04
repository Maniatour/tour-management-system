-- 상품 ID 통합 및 옵션 매핑 마이그레이션
-- MDGCSUNRISE와 MDGCSUNRISE_X를 MDGCSUNRISE로 통합하고 selected_options에 필수 선택 옵션 추가

-- 1. 먼저 현재 데이터 상황 확인을 위한 뷰 생성
CREATE OR REPLACE VIEW product_id_analysis AS
SELECT 
    product_id,
    COUNT(*) as reservation_count,
    array_agg(DISTINCT status) as statuses,
    array_agg(DISTINCT channel_id) as channels
FROM reservations 
WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X')
GROUP BY product_id;

-- 2. 상품 옵션 ID 조회를 위한 함수
CREATE OR REPLACE FUNCTION get_product_option_id(product_id TEXT, option_name TEXT)
RETURNS UUID AS $$
DECLARE
    option_id UUID;
BEGIN
    SELECT po.id INTO option_id
    FROM product_options po
    WHERE po.product_id = product_id 
    AND po.name = option_name
    AND po.is_required = true
    LIMIT 1;
    
    RETURN option_id;
END;
$$ LANGUAGE plpgsql;

-- 3. 선택 옵션을 추가하는 함수
CREATE OR REPLACE FUNCTION add_required_option_to_selected_options(
    reservation_id TEXT,
    product_id TEXT,
    option_name TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    option_id UUID;
    current_options JSONB;
    updated_options JSONB;
BEGIN
    -- 옵션 ID 조회
    SELECT get_product_option_id(product_id, option_name) INTO option_id;
    
    IF option_id IS NULL THEN
        RAISE NOTICE 'Option not found: % for product %', option_name, product_id;
        RETURN FALSE;
    END IF;
    
    -- 현재 selected_options 가져오기
    SELECT COALESCE(selected_options, '{}'::jsonb) INTO current_options
    FROM reservations 
    WHERE id = reservation_id;
    
    -- 옵션 추가
    updated_options := current_options || jsonb_build_object(option_id::text, jsonb_build_array());
    
    -- 업데이트
    UPDATE reservations 
    SET selected_options = updated_options
    WHERE id = reservation_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. 상품 ID 매핑 및 옵션 추가를 위한 함수
CREATE OR REPLACE FUNCTION migrate_product_ids()
RETURNS TABLE(
    old_product_id TEXT,
    new_product_id TEXT,
    option_name TEXT,
    updated_count INTEGER
) AS $$
DECLARE
    rec RECORD;
    option_id UUID;
    updated_count INTEGER;
BEGIN
    -- MDGCSUNRISE_X를 MDGCSUNRISE로 변경하고 Antelope X Canyon 옵션 추가
    UPDATE reservations 
    SET product_id = 'MDGCSUNRISE'
    WHERE product_id = 'MDGCSUNRISE_X';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Antelope X Canyon 옵션 ID 조회
    SELECT get_product_option_id('MDGCSUNRISE', 'Antelope X Canyon') INTO option_id;
    
    -- MDGCSUNRISE_X에서 변경된 예약들에 Antelope X Canyon 옵션 추가
    IF option_id IS NOT NULL THEN
        UPDATE reservations 
        SET selected_options = COALESCE(selected_options, '{}'::jsonb) || 
            jsonb_build_object(option_id::text, jsonb_build_array())
        WHERE product_id = 'MDGCSUNRISE' 
        AND id IN (
            SELECT id FROM reservations 
            WHERE product_id = 'MDGCSUNRISE'
            AND (selected_options IS NULL OR selected_options = '{}'::jsonb)
        );
    END IF;
    
    RETURN QUERY SELECT 'MDGCSUNRISE_X'::TEXT, 'MDGCSUNRISE'::TEXT, 'Antelope X Canyon'::TEXT, updated_count;
    
    -- 기존 MDGCSUNRISE에 Lower Antelope Canyon 옵션 추가
    SELECT get_product_option_id('MDGCSUNRISE', 'Lower Antelope Canyon') INTO option_id;
    
    IF option_id IS NOT NULL THEN
        UPDATE reservations 
        SET selected_options = COALESCE(selected_options, '{}'::jsonb) || 
            jsonb_build_object(option_id::text, jsonb_build_array())
        WHERE product_id = 'MDGCSUNRISE' 
        AND (selected_options IS NULL OR selected_options = '{}'::jsonb)
        AND id NOT IN (
            SELECT id FROM reservations 
            WHERE product_id = 'MDGCSUNRISE'
            AND selected_options ? option_id::text
        );
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSE
        updated_count := 0;
    END IF;
    
    RETURN QUERY SELECT 'MDGCSUNRISE'::TEXT, 'MDGCSUNRISE'::TEXT, 'Lower Antelope Canyon'::TEXT, updated_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 마이그레이션 실행 전 백업 테이블 생성
CREATE TABLE IF NOT EXISTS reservations_backup_before_product_migration AS
SELECT * FROM reservations WHERE product_id IN ('MDGCSUNRISE', 'MDGCSUNRISE_X');

-- 6. 마이그레이션 실행
-- SELECT * FROM migrate_product_ids();

-- 7. 결과 확인을 위한 뷰
CREATE OR REPLACE VIEW migration_results AS
SELECT 
    'Before Migration' as status,
    product_id,
    COUNT(*) as count
FROM reservations_backup_before_product_migration
GROUP BY product_id
UNION ALL
SELECT 
    'After Migration' as status,
    product_id,
    COUNT(*) as count
FROM reservations
WHERE product_id = 'MDGCSUNRISE'
GROUP BY product_id;

-- 8. 옵션 추가 결과 확인을 위한 뷰
CREATE OR REPLACE VIEW option_migration_results AS
SELECT 
    r.id,
    r.product_id,
    r.selected_options,
    CASE 
        WHEN r.selected_options ? (po1.id::text) THEN 'Lower Antelope Canyon'
        WHEN r.selected_options ? (po2.id::text) THEN 'Antelope X Canyon'
        ELSE 'No option'
    END as assigned_option
FROM reservations r
LEFT JOIN product_options po1 ON po1.product_id = 'MDGCSUNRISE' AND po1.name = 'Lower Antelope Canyon'
LEFT JOIN product_options po2 ON po2.product_id = 'MDGCSUNRISE' AND po2.name = 'Antelope X Canyon'
WHERE r.product_id = 'MDGCSUNRISE';
