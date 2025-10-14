-- 가이드비 관리 페이지를 위한 SQL 쿼리들
-- 작성일: 2024-10-13

-- 1. Mania Tour/Mania Service 상품 목록 조회
SELECT 
    p.id,
    p.name,
    p.sub_category,
    p.status,
    COUNT(pgc.id) as guide_cost_count
FROM products p
LEFT JOIN product_guide_costs pgc ON p.id = pgc.product_id AND pgc.is_active = true
WHERE (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%')
GROUP BY p.id, p.name, p.sub_category, p.status
ORDER BY p.name;

-- 2. 특정 상품의 가이드비 설정 조회
SELECT 
    pgc.id,
    pgc.team_type,
    pgc.guide_fee,
    pgc.assistant_fee,
    pgc.driver_fee,
    pgc.effective_from,
    pgc.effective_to,
    pgc.is_active,
    pgc.created_at,
    pgc.updated_at
FROM product_guide_costs pgc
WHERE pgc.product_id = '상품_ID_여기에_입력'
ORDER BY pgc.team_type, pgc.effective_from DESC;

-- 3. 현재 유효한 가이드비 조회
SELECT 
    p.name as product_name,
    pgc.team_type,
    pgc.guide_fee,
    pgc.assistant_fee,
    pgc.driver_fee,
    pgc.effective_from,
    pgc.effective_to
FROM products p
JOIN product_guide_costs pgc ON p.id = pgc.product_id
WHERE (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%')
    AND pgc.is_active = true
    AND pgc.effective_from <= CURRENT_DATE
    AND (pgc.effective_to IS NULL OR pgc.effective_to >= CURRENT_DATE)
ORDER BY p.name, pgc.team_type;

-- 4. 가이드비 설정 추가 예시
-- 1가이드 투어 비용 설정 (11월 1일부터)
SELECT set_product_guide_costs(
    '상품_ID_텍스트',
    '1_guide',
    150.00,  -- 가이드 비용
    0.00,    -- 어시스턴트 비용
    0.00,    -- 드라이버 비용
    '2024-11-01',
    NULL
);

-- 2가이드 투어 비용 설정 (11월 1일부터)
SELECT set_product_guide_costs(
    '상품_ID_텍스트',
    '2_guides',
    300.00,  -- 가이드 비용 (150 * 2)
    0.00,    -- 어시스턴트 비용
    0.00,    -- 드라이버 비용
    '2024-11-01',
    NULL
);

-- 가이드+드라이버 투어 비용 설정 (11월 1일부터)
SELECT set_product_guide_costs(
    '상품_ID_텍스트',
    'guide_driver',
    150.00,  -- 가이드 비용
    0.00,    -- 어시스턴트 비용
    100.00,  -- 드라이버 비용
    '2024-11-01',
    NULL
);

-- 5. 가이드비 변경 이력 조회
SELECT 
    p.name as product_name,
    pgc.team_type,
    gch.action,
    gch.old_guide_fee,
    gch.new_guide_fee,
    gch.old_assistant_fee,
    gch.new_assistant_fee,
    gch.old_driver_fee,
    gch.new_driver_fee,
    gch.old_effective_from,
    gch.new_effective_from,
    gch.changed_at
FROM guide_cost_history gch
JOIN product_guide_costs pgc ON gch.product_guide_cost_id = pgc.id
JOIN products p ON pgc.product_id = p.id
WHERE p.id = '상품_ID_여기에_입력'
ORDER BY gch.changed_at DESC;

-- 6. 일괄 가이드비 업데이트 (모든 Mania Tour/Service 상품)
-- 11월 1일부터 모든 가이드비를 20달러씩 인상
SELECT bulk_update_guide_costs(
    '2024-11-01',  -- effective_from
    20.00,         -- guide_fee_increase
    0.00,          -- assistant_fee_increase
    10.00          -- driver_fee_increase
);

-- 7. 가이드비 통계 조회
SELECT 
    pgc.team_type,
    COUNT(DISTINCT pgc.product_id) as product_count,
    AVG(pgc.guide_fee) as avg_guide_fee,
    AVG(pgc.assistant_fee) as avg_assistant_fee,
    AVG(pgc.driver_fee) as avg_driver_fee,
    MIN(pgc.effective_from) as earliest_effective,
    MAX(pgc.effective_to) as latest_effective
FROM product_guide_costs pgc
JOIN products p ON pgc.product_id = p.id
WHERE (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%')
    AND pgc.is_active = true
    AND pgc.effective_from <= CURRENT_DATE
    AND (pgc.effective_to IS NULL OR pgc.effective_to >= CURRENT_DATE)
GROUP BY pgc.team_type
ORDER BY pgc.team_type;

-- 8. 만료 예정인 가이드비 조회 (30일 이내)
SELECT 
    p.name as product_name,
    pgc.team_type,
    pgc.guide_fee,
    pgc.assistant_fee,
    pgc.driver_fee,
    pgc.effective_to,
    (pgc.effective_to - CURRENT_DATE) as days_until_expiry
FROM products p
JOIN product_guide_costs pgc ON p.id = pgc.product_id
WHERE (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%')
    AND pgc.is_active = true
    AND pgc.effective_to IS NOT NULL
    AND pgc.effective_to BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
ORDER BY pgc.effective_to;

-- 완료 메시지
SELECT '가이드비 관리 시스템 쿼리 예시가 준비되었습니다.' as message;
