-- 쿠폰 테이블 다중 상품 ID 지원 업데이트
-- product_id 컬럼을 TEXT로 변경하여 쉼표로 구분된 여러 상품 ID 저장 가능

-- 1. 기존 외래키 제약조건 제거
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_product_id_fkey;

-- 2. product_id 컬럼을 TEXT로 변경 (이미 TEXT인 경우 무시)
DO $$ 
BEGIN
    -- product_id 컬럼이 존재하는지 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coupons' 
        AND column_name = 'product_id'
    ) THEN
        -- 컬럼 타입을 TEXT로 변경 (이미 TEXT인 경우 무시)
        ALTER TABLE coupons ALTER COLUMN product_id TYPE TEXT;
        RAISE NOTICE 'Updated product_id column to TEXT type for multiple product IDs support';
    ELSE
        -- product_id 컬럼이 없는 경우 새로 생성
        ALTER TABLE coupons ADD COLUMN product_id TEXT;
        RAISE NOTICE 'Added product_id column as TEXT type';
    END IF;
END $$;

-- 3. product_id 컬럼에 코멘트 추가
COMMENT ON COLUMN coupons.product_id IS '적용 상품 ID들 (쉼표로 구분된 여러 ID, 예: "product1,product2,product3")';

-- 4. 기존 인덱스 재생성 (TEXT 타입에 맞게)
DROP INDEX IF EXISTS idx_coupons_product;
CREATE INDEX idx_coupons_product ON coupons(product_id);

-- 5. 다중 상품 ID 검증을 위한 함수 생성
CREATE OR REPLACE FUNCTION validate_product_ids(product_ids TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    product_id TEXT;
    product_count INTEGER;
BEGIN
    -- NULL이거나 빈 문자열인 경우 유효
    IF product_ids IS NULL OR TRIM(product_ids) = '' THEN
        RETURN TRUE;
    END IF;
    
    -- 쉼표로 구분된 각 상품 ID 검증
    FOR product_id IN SELECT TRIM(unnest(string_to_array(product_ids, ',')))
    LOOP
        -- 빈 문자열이 아닌 경우에만 검증
        IF product_id != '' THEN
            -- products 테이블에 해당 ID가 존재하는지 확인
            SELECT COUNT(*) INTO product_count 
            FROM products 
            WHERE id = product_id;
            
            -- 존재하지 않는 상품 ID가 있으면 FALSE 반환
            IF product_count = 0 THEN
                RETURN FALSE;
            END IF;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 6. 다중 상품 ID 검증을 위한 체크 제약조건 추가
ALTER TABLE coupons ADD CONSTRAINT chk_coupons_valid_product_ids 
CHECK (validate_product_ids(product_id));

-- 7. 다중 상품 ID를 개별 행으로 분리하는 뷰 생성 (쿼리 편의용)
CREATE OR REPLACE VIEW coupons_products_view AS
SELECT 
    c.id as coupon_id,
    c.coupon_code,
    c.discount_type,
    c.percentage_value,
    c.fixed_value,
    c.status,
    c.description,
    c.start_date,
    c.end_date,
    c.channel_id,
    TRIM(unnest(string_to_array(c.product_id, ','))) as product_id,
    p.name as product_name,
    c.created_at,
    c.updated_at
FROM coupons c
CROSS JOIN LATERAL unnest(string_to_array(c.product_id, ',')) AS product_id_array
LEFT JOIN products p ON TRIM(product_id_array) = p.id
WHERE c.product_id IS NOT NULL AND TRIM(c.product_id) != '';

-- 8. 뷰에 코멘트 추가
COMMENT ON VIEW coupons_products_view IS '쿠폰과 상품의 다대다 관계를 개별 행으로 표시하는 뷰';

-- 9. 샘플 데이터 업데이트 (기존 데이터가 있다면)
-- 여러 상품에 적용되는 쿠폰 예시
UPDATE coupons 
SET product_id = (
    SELECT STRING_AGG(id, ',') 
    FROM products 
    WHERE status = 'active' 
    LIMIT 2
)
WHERE coupon_code = 'WELCOME10' AND product_id IS NULL;

-- 10. 새로운 샘플 쿠폰 추가 (다중 상품 적용)
INSERT INTO coupons (
    coupon_code, 
    discount_type, 
    percentage_value, 
    fixed_value, 
    status, 
    description, 
    start_date, 
    end_date, 
    channel_id, 
    product_id
) VALUES 
(
    'MULTI10', 
    'percentage', 
    10.00, 
    NULL, 
    'active', 
    '여러 상품 10% 할인', 
    '2024-01-01', 
    '2024-12-31', 
    NULL, 
    (SELECT STRING_AGG(id, ',') FROM products WHERE status = 'active' LIMIT 3)
),
(
    'CHANNEL_MULTI', 
    'fixed', 
    NULL, 
    15.00, 
    'active', 
    '특정 채널 다중 상품 15달러 할인', 
    '2024-01-01', 
    '2024-12-31', 
    (SELECT id FROM channels WHERE name = '네이버 여행' LIMIT 1), 
    (SELECT STRING_AGG(id, ',') FROM products WHERE status = 'active' LIMIT 2)
);

-- 11. 마이그레이션 완료 로그
DO $$
BEGIN
    RAISE NOTICE 'Coupons table updated successfully for multiple product IDs support';
    RAISE NOTICE 'Added validation function and view for better query support';
    RAISE NOTICE 'Sample data updated with multi-product coupons';
END $$;
