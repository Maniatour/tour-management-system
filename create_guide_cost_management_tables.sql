-- 가이드 비용 관리 시스템 테이블 생성
-- 작성일: 2024-10-13

-- 1. 상품별 가이드 비용 설정 테이블
CREATE TABLE product_guide_costs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    team_type VARCHAR(20) NOT NULL CHECK (team_type IN ('1_guide', '2_guides', 'guide_driver')),
    guide_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    assistant_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    driver_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 가이드 비용 변경 이력 테이블
CREATE TABLE guide_cost_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_guide_cost_id UUID NOT NULL REFERENCES product_guide_costs(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'deactivated')),
    old_guide_fee DECIMAL(10,2),
    new_guide_fee DECIMAL(10,2),
    old_assistant_fee DECIMAL(10,2),
    new_assistant_fee DECIMAL(10,2),
    old_driver_fee DECIMAL(10,2),
    new_driver_fee DECIMAL(10,2),
    old_effective_from DATE,
    new_effective_from DATE,
    old_effective_to DATE,
    new_effective_to DATE,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX idx_product_guide_costs_product_id ON product_guide_costs(product_id);
CREATE INDEX idx_product_guide_costs_team_type ON product_guide_costs(team_type);
CREATE INDEX idx_product_guide_costs_effective_period ON product_guide_costs(effective_from, effective_to);
CREATE INDEX idx_product_guide_costs_active ON product_guide_costs(is_active);
CREATE INDEX idx_guide_cost_history_product_cost_id ON guide_cost_history(product_guide_cost_id);
CREATE INDEX idx_guide_cost_history_changed_at ON guide_cost_history(changed_at);

-- 4. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_product_guide_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. 업데이트 트리거
CREATE TRIGGER trigger_update_product_guide_costs_updated_at
    BEFORE UPDATE ON product_guide_costs
    FOR EACH ROW
    EXECUTE FUNCTION update_product_guide_costs_updated_at();

-- 6. 가이드 비용 변경 이력 자동 기록 트리거 함수
CREATE OR REPLACE FUNCTION log_guide_cost_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT (새로 생성)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO guide_cost_history (
            product_guide_cost_id,
            action,
            new_guide_fee,
            new_assistant_fee,
            new_driver_fee,
            new_effective_from,
            new_effective_to
        ) VALUES (
            NEW.id,
            'created',
            NEW.guide_fee,
            NEW.assistant_fee,
            NEW.driver_fee,
            NEW.effective_from,
            NEW.effective_to
        );
        RETURN NEW;
    END IF;
    
    -- UPDATE (수정)
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO guide_cost_history (
            product_guide_cost_id,
            action,
            old_guide_fee,
            new_guide_fee,
            old_assistant_fee,
            new_assistant_fee,
            old_driver_fee,
            new_driver_fee,
            old_effective_from,
            new_effective_from,
            old_effective_to,
            new_effective_to
        ) VALUES (
            NEW.id,
            'updated',
            OLD.guide_fee,
            NEW.guide_fee,
            OLD.assistant_fee,
            NEW.assistant_fee,
            OLD.driver_fee,
            NEW.driver_fee,
            OLD.effective_from,
            NEW.effective_from,
            OLD.effective_to,
            NEW.effective_to
        );
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. 변경 이력 트리거
CREATE TRIGGER trigger_log_guide_cost_changes
    AFTER INSERT OR UPDATE ON product_guide_costs
    FOR EACH ROW
    EXECUTE FUNCTION log_guide_cost_changes();

-- 8. 현재 유효한 가이드 비용 조회 함수
CREATE OR REPLACE FUNCTION get_current_guide_costs(
    p_product_id TEXT,
    p_team_type VARCHAR(20),
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    guide_fee DECIMAL(10,2),
    assistant_fee DECIMAL(10,2),
    driver_fee DECIMAL(10,2),
    effective_from DATE,
    effective_to DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pgc.guide_fee,
        pgc.assistant_fee,
        pgc.driver_fee,
        pgc.effective_from,
        pgc.effective_to
    FROM product_guide_costs pgc
    WHERE pgc.product_id = p_product_id
        AND pgc.team_type = p_team_type
        AND pgc.is_active = true
        AND pgc.effective_from <= p_date
        AND (pgc.effective_to IS NULL OR pgc.effective_to >= p_date)
    ORDER BY pgc.effective_from DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. 상품별 가이드 비용 설정 함수
CREATE OR REPLACE FUNCTION set_product_guide_costs(
    p_product_id TEXT,
    p_team_type VARCHAR(20),
    p_guide_fee DECIMAL(10,2),
    p_assistant_fee DECIMAL(10,2),
    p_driver_fee DECIMAL(10,2),
    p_effective_from DATE,
    p_effective_to DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_cost_id UUID;
BEGIN
    -- 기존 설정이 있으면 비활성화
    UPDATE product_guide_costs 
    SET 
        is_active = false,
        effective_to = p_effective_from - INTERVAL '1 day',
        updated_at = NOW()
    WHERE product_id = p_product_id 
        AND team_type = p_team_type 
        AND is_active = true
        AND effective_to IS NULL;
    
    -- 새 설정 추가
    INSERT INTO product_guide_costs (
        product_id,
        team_type,
        guide_fee,
        assistant_fee,
        driver_fee,
        effective_from,
        effective_to
    ) VALUES (
        p_product_id,
        p_team_type,
        p_guide_fee,
        p_assistant_fee,
        p_driver_fee,
        p_effective_from,
        p_effective_to
    ) RETURNING id INTO new_cost_id;
    
    RETURN new_cost_id;
END;
$$ LANGUAGE plpgsql;

-- 10. RLS (Row Level Security) 정책 설정
ALTER TABLE product_guide_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_cost_history ENABLE ROW LEVEL SECURITY;

-- 11. RLS 정책 생성
-- product_guide_costs 테이블 정책
CREATE POLICY "product_guide_costs_select_policy" ON product_guide_costs
    FOR SELECT USING (true);

CREATE POLICY "product_guide_costs_insert_policy" ON product_guide_costs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "product_guide_costs_update_policy" ON product_guide_costs
    FOR UPDATE USING (true);

CREATE POLICY "product_guide_costs_delete_policy" ON product_guide_costs
    FOR DELETE USING (true);

-- guide_cost_history 테이블 정책
CREATE POLICY "guide_cost_history_select_policy" ON guide_cost_history
    FOR SELECT USING (true);

CREATE POLICY "guide_cost_history_insert_policy" ON guide_cost_history
    FOR INSERT WITH CHECK (true);

-- 12. 샘플 데이터 삽입 (테스트용)
-- Mania Tour 상품의 가이드 비용 설정 예시
-- INSERT INTO product_guide_costs (
--     product_id,
--     team_type,
--     guide_fee,
--     assistant_fee,
--     driver_fee,
--     effective_from,
--     effective_to,
--     created_by
-- ) VALUES 
-- -- 1가이드 투어 (10월 31일까지)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     '1_guide',
--     150.00,
--     0.00,
--     0.00,
--     '2024-01-01',
--     '2024-10-31',
--     (SELECT id FROM auth.users LIMIT 1)
-- ),
-- -- 1가이드 투어 (11월 1일부터)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     '1_guide',
--     180.00,
--     0.00,
--     0.00,
--     '2024-11-01',
--     NULL,
--     (SELECT id FROM auth.users LIMIT 1)
-- ),
-- -- 2가이드 투어 (10월 31일까지)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     '2_guides',
--     300.00,
--     0.00,
--     0.00,
--     '2024-01-01',
--     '2024-10-31',
--     (SELECT id FROM auth.users LIMIT 1)
-- ),
-- -- 2가이드 투어 (11월 1일부터)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     '2_guides',
--     360.00,
--     0.00,
--     0.00,
--     '2024-11-01',
--     NULL,
--     (SELECT id FROM auth.users LIMIT 1)
-- ),
-- -- 가이드+드라이버 투어 (10월 31일까지)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     'guide_driver',
--     150.00,
--     0.00,
--     100.00,
--     '2024-01-01',
--     '2024-10-31',
--     (SELECT id FROM auth.users LIMIT 1)
-- ),
-- -- 가이드+드라이버 투어 (11월 1일부터)
-- (
--     (SELECT id FROM products WHERE sub_category ILIKE '%mania tour%' LIMIT 1),
--     'guide_driver',
--     180.00,
--     0.00,
--     120.00,
--     '2024-11-01',
--     NULL,
--     (SELECT id FROM auth.users LIMIT 1)
-- );

-- 13. 뷰 생성 (현재 유효한 가이드 비용 조회용)
CREATE VIEW current_guide_costs AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.sub_category,
    pgc.team_type,
    pgc.guide_fee,
    pgc.assistant_fee,
    pgc.driver_fee,
    pgc.effective_from,
    pgc.effective_to,
    pgc.created_at,
    pgc.updated_at
FROM products p
JOIN product_guide_costs pgc ON p.id = pgc.product_id
WHERE pgc.is_active = true
    AND pgc.effective_from <= CURRENT_DATE
    AND (pgc.effective_to IS NULL OR pgc.effective_to >= CURRENT_DATE)
    AND (p.sub_category ILIKE '%mania tour%' OR p.sub_category ILIKE '%mania service%');

-- 14. 주석 추가
COMMENT ON TABLE product_guide_costs IS '상품별 가이드 비용 설정 테이블';
COMMENT ON TABLE guide_cost_history IS '가이드 비용 변경 이력 테이블';
COMMENT ON FUNCTION get_current_guide_costs IS '특정 날짜의 현재 유효한 가이드 비용 조회';
COMMENT ON FUNCTION set_product_guide_costs IS '상품별 가이드 비용 설정';
COMMENT ON VIEW current_guide_costs IS '현재 유효한 가이드 비용 조회용 뷰';

-- 완료 메시지
SELECT '가이드 비용 관리 시스템 테이블이 성공적으로 생성되었습니다.' as message;
