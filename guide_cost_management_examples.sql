-- 가이드 비용 관리 시스템 사용 예시 및 추가 기능
-- 작성일: 2024-10-13

-- 1. 현재 유효한 가이드 비용 조회 예시
-- 특정 상품의 현재 가이드 비용 조회
SELECT * FROM get_current_guide_costs(
    '상품_ID_텍스트',
    '1_guide',
    CURRENT_DATE
);

-- 2. 상품별 가이드 비용 설정 예시
-- 11월 1일부터 새로운 가이드 비용 설정
SELECT set_product_guide_costs(
    '상품_ID_텍스트',  -- product_id (TEXT)
    '1_guide',         -- team_type
    180.00,            -- guide_fee
    0.00,              -- assistant_fee
    0.00,              -- driver_fee
    '2024-11-01',      -- effective_from
    NULL               -- effective_to (NULL이면 무제한)
);

-- 3. Mania Tour/Mania Service 상품들의 현재 가이드 비용 조회
SELECT 
    p.name as product_name,
    p.sub_category,
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

-- 4. 가이드 비용 변경 이력 조회
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
    gch.change_reason,
    gch.changed_at,
    u.email as changed_by_email
FROM guide_cost_history gch
JOIN product_guide_costs pgc ON gch.product_guide_cost_id = pgc.id
JOIN products p ON pgc.product_id = p.id
LEFT JOIN auth.users u ON gch.changed_by = u.id
WHERE p.id = '상품_ID_여기에_입력'
ORDER BY gch.changed_at DESC;

-- 5. 특정 기간의 가이드 비용 조회
-- 2024년 10월 13일 기준으로 유효했던 가이드 비용들
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
    AND pgc.effective_from <= '2024-10-13'
    AND (pgc.effective_to IS NULL OR pgc.effective_to >= '2024-10-13')
ORDER BY p.name, pgc.team_type;

-- 6. 가이드 비용 통계 조회
-- 팀 타입별 평균 가이드 비용
SELECT 
    pgc.team_type,
    COUNT(*) as product_count,
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

-- 7. 만료 예정인 가이드 비용 조회 (30일 이내)
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

-- 8. 가이드 비용 일괄 업데이트 함수
CREATE OR REPLACE FUNCTION bulk_update_guide_costs(
    p_effective_from DATE,
    p_guide_fee_increase DECIMAL(10,2) DEFAULT 0,
    p_assistant_fee_increase DECIMAL(10,2) DEFAULT 0,
    p_driver_fee_increase DECIMAL(10,2) DEFAULT 0
)
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    cost_record RECORD;
BEGIN
    -- 현재 활성화된 모든 Mania Tour/Service 상품의 가이드 비용을 새로운 기간으로 복사
    FOR cost_record IN 
        SELECT DISTINCT pgc.product_id, pgc.team_type
        FROM product_guide_costs pgc
        JOIN products p ON pgc.product_id = p.id
        WHERE (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%')
            AND pgc.is_active = true
            AND pgc.effective_from <= CURRENT_DATE
            AND (pgc.effective_to IS NULL OR pgc.effective_to >= CURRENT_DATE)
    LOOP
        -- 기존 설정 비활성화
        UPDATE product_guide_costs 
        SET 
            is_active = false,
            effective_to = p_effective_from - INTERVAL '1 day',
            updated_at = NOW()
        WHERE product_id = cost_record.product_id 
            AND team_type = cost_record.team_type 
            AND is_active = true
            AND effective_to IS NULL;
        
        -- 새 설정 추가 (비용 증가 적용)
        INSERT INTO product_guide_costs (
            product_id,
            team_type,
            guide_fee,
            assistant_fee,
            driver_fee,
            effective_from,
            effective_to
        )
        SELECT 
            cost_record.product_id,
            cost_record.team_type,
            pgc.guide_fee + p_guide_fee_increase,
            pgc.assistant_fee + p_assistant_fee_increase,
            pgc.driver_fee + p_driver_fee_increase,
            p_effective_from,
            NULL
        FROM product_guide_costs pgc
        WHERE pgc.product_id = cost_record.product_id 
            AND pgc.team_type = cost_record.team_type 
            AND pgc.is_active = true
            AND pgc.effective_from <= CURRENT_DATE
            AND (pgc.effective_to IS NULL OR pgc.effective_to >= CURRENT_DATE)
        LIMIT 1;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- 9. 일괄 업데이트 사용 예시
-- 11월 1일부터 모든 가이드 비용을 20달러씩 인상
-- SELECT bulk_update_guide_costs(
--     '2024-11-01',  -- effective_from
--     20.00,         -- guide_fee_increase
--     0.00,          -- assistant_fee_increase
--     10.00          -- driver_fee_increase
-- );

-- 10. 가이드 비용 검증 함수
CREATE OR REPLACE FUNCTION validate_guide_costs(
    p_product_id TEXT,
    p_team_type VARCHAR(20),
    p_effective_from DATE,
    p_effective_to DATE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    overlap_count INTEGER;
BEGIN
    -- 기간 중복 검사
    SELECT COUNT(*)
    INTO overlap_count
    FROM product_guide_costs
    WHERE product_id = p_product_id
        AND team_type = p_team_type
        AND is_active = true
        AND daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[]') 
            && daterange(p_effective_from, COALESCE(p_effective_to, 'infinity'::date), '[]');
    
    RETURN overlap_count = 0;
END;
$$ LANGUAGE plpgsql;

-- 11. 가이드 비용 검증 사용 예시
-- SELECT validate_guide_costs(
--     '상품_ID_텍스트',
--     '1_guide',
--     '2024-11-01',
--     '2024-12-31'
-- );

-- 완료 메시지
SELECT '가이드 비용 관리 시스템 사용 예시 및 추가 기능이 준비되었습니다.' as message;
