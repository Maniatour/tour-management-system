-- products 테이블에 choices 컬럼 추가
-- 기존 상품 ID 구분 방식을 초이스 시스템으로 통합

-- 1. products 테이블에 choices 컬럼 추가
ALTER TABLE products ADD COLUMN choices JSONB;

-- 2. choices 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_products_choices ON products USING GIN (choices);

-- 3. 기존 상품들의 choices 데이터 설정
-- MDGCSUNRISE 상품에 초이스 정보 추가
UPDATE products 
SET choices = '{
  "required": [
    {
      "id": "canyon_choice",
      "name": "Canyon Choice",
      "name_ko": "캐년 선택",
      "type": "radio",
      "description": "Lower Antelope Canyon과 Antelope X Canyon 중 선택하세요",
      "options": [
        {
          "id": "antelope_lower",
          "name": "Lower Antelope Canyon",
          "name_ko": "로어 앤텔로프 캐년",
          "price": 0,
          "is_default": true
        },
        {
          "id": "antelope_x",
          "name": "Antelope X Canyon", 
          "name_ko": "앤텔로프 X 캐년",
          "price": 0,
          "is_default": false
        }
      ]
    }
  ]
}'::jsonb
WHERE id = 'MDGCSUNRISE';

-- 4. 다른 상품들도 비슷한 패턴으로 설정 (필요시)
-- 예: MDGC1D 상품이 있다면
-- UPDATE products 
-- SET choices = '{
--   "required": [
--     {
--       "id": "tour_type_choice",
--       "name": "Tour Type",
--       "name_ko": "투어 타입",
--       "type": "radio",
--       "description": "투어 타입을 선택하세요",
--       "options": [
--         {
--           "id": "standard",
--           "name": "Standard Tour",
--           "name_ko": "스탠다드 투어",
--           "price": 0,
--           "is_default": true
--         }
--       ]
--     }
--   ]
-- }'::jsonb
-- WHERE id = 'MDGC1D';

-- 5. choices 컬럼에 대한 제약 조건 추가 (선택사항)
-- ALTER TABLE products ADD CONSTRAINT check_choices_format 
-- CHECK (choices IS NULL OR (
--   choices ? 'required' AND 
--   jsonb_typeof(choices->'required') = 'array'
-- ));

-- 6. 기존 product_options 테이블과의 호환성을 위한 뷰 생성
CREATE OR REPLACE VIEW product_choices_view AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.choices,
    choice_item->>'id' as choice_id,
    choice_item->>'name' as choice_name,
    choice_item->>'name_ko' as choice_name_ko,
    choice_item->>'type' as choice_type,
    choice_item->>'description' as choice_description,
    choice_option->>'id' as option_id,
    choice_option->>'name' as option_name,
    choice_option->>'name_ko' as option_name_ko,
    (choice_option->>'price')::numeric as option_price,
    (choice_option->>'is_default')::boolean as is_default
FROM products p,
     jsonb_array_elements(p.choices->'required') as choice_item,
     jsonb_array_elements(choice_item->'options') as choice_option
WHERE p.choices IS NOT NULL;

-- 7. 기존 예약 데이터를 choices 시스템으로 마이그레이션하는 함수
CREATE OR REPLACE FUNCTION migrate_reservations_to_choices()
RETURNS TABLE(
    reservation_id TEXT,
    old_product_id TEXT,
    new_product_id TEXT,
    choice_selection JSONB,
    updated BOOLEAN
) AS $$
DECLARE
    rec RECORD;
    choice_selection JSONB;
    updated_count INTEGER;
BEGIN
    -- MDGCSUNRISE_X 예약들을 MDGCSUNRISE로 변경하고 초이스 정보 추가
    FOR rec IN 
        SELECT id, product_id, selected_options
        FROM reservations 
        WHERE product_id = 'MDGCSUNRISE_X'
    LOOP
        -- 초이스 선택 정보 생성
        choice_selection := jsonb_build_object(
            'canyon_choice', jsonb_build_object(
                'selected', 'antelope_x',
                'timestamp', NOW()
            )
        );
        
        -- 예약 업데이트
        UPDATE reservations 
        SET 
            product_id = 'MDGCSUNRISE',
            selected_choices = choice_selection,
            updated_at = NOW()
        WHERE id = rec.id;
        
        updated_count := updated_count + 1;
        
        RETURN QUERY SELECT 
            rec.id,
            'MDGCSUNRISE_X',
            'MDGCSUNRISE',
            choice_selection,
            TRUE;
    END LOOP;
    
    -- 기존 MDGCSUNRISE 예약들에 기본 초이스 선택 추가 (아직 선택하지 않은 경우)
    FOR rec IN 
        SELECT id, product_id, selected_choices
        FROM reservations 
        WHERE product_id = 'MDGCSUNRISE'
        AND (selected_choices IS NULL OR selected_choices = '{}'::jsonb)
    LOOP
        -- 기본 초이스 선택 정보 생성 (Lower Antelope Canyon)
        choice_selection := jsonb_build_object(
            'canyon_choice', jsonb_build_object(
                'selected', 'antelope_lower',
                'timestamp', NOW()
            )
        );
        
        -- 예약 업데이트
        UPDATE reservations 
        SET 
            selected_choices = choice_selection,
            updated_at = NOW()
        WHERE id = rec.id;
        
        updated_count := updated_count + 1;
        
        RETURN QUERY SELECT 
            rec.id,
            'MDGCSUNRISE',
            'MDGCSUNRISE',
            choice_selection,
            TRUE;
    END LOOP;
    
    -- 결과 요약
    RAISE NOTICE 'Total reservations updated: %', updated_count;
END;
$$ LANGUAGE plpgsql;

-- 8. reservations 테이블에 selected_choices 컬럼 추가 (아직 없다면)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservations' 
        AND column_name = 'selected_choices'
    ) THEN
        ALTER TABLE reservations ADD COLUMN selected_choices JSONB;
    END IF;
END $$;

-- 9. selected_choices 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservations_selected_choices 
ON reservations USING GIN (selected_choices);

-- 10. 마이그레이션 실행 (주석 해제하여 실행)
-- SELECT * FROM migrate_reservations_to_choices();

-- 11. 결과 확인을 위한 쿼리
-- SELECT 
--     p.id as product_id,
--     p.name as product_name,
--     p.choices,
--     COUNT(r.id) as reservation_count
-- FROM products p
-- LEFT JOIN reservations r ON p.id = r.product_id
-- WHERE p.choices IS NOT NULL
-- GROUP BY p.id, p.name, p.choices
-- ORDER BY p.id;
