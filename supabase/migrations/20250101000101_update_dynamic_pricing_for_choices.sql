-- dynamic_pricing 테이블을 choices 시스템에 맞게 수정
-- options_pricing을 choices_pricing으로 변경

-- 1. dynamic_pricing 테이블에 choices_pricing 컬럼 추가
ALTER TABLE dynamic_pricing ADD COLUMN choices_pricing JSONB;

-- 2. 기존 options_pricing 데이터를 choices_pricing으로 마이그레이션
CREATE OR REPLACE FUNCTION migrate_dynamic_pricing_to_choices()
RETURNS TABLE(
    product_id TEXT,
    channel_id TEXT,
    date TEXT,
    old_options_pricing JSONB,
    new_choices_pricing JSONB,
    updated BOOLEAN
) AS $$
DECLARE
    rec RECORD;
    choices_pricing JSONB;
    option_item RECORD;
    choice_option RECORD;
    product_choices JSONB;
    choice_id TEXT;
    option_id TEXT;
    option_name TEXT;
    option_price NUMERIC;
    choice_item RECORD;
BEGIN
    FOR rec IN 
        SELECT 
            dp.product_id,
            dp.channel_id,
            dp.date,
            dp.options_pricing,
            p.choices
        FROM dynamic_pricing dp
        LEFT JOIN products p ON dp.product_id = p.id
        WHERE dp.options_pricing IS NOT NULL 
        AND dp.options_pricing != '[]'::jsonb
        AND dp.options_pricing != '{}'::jsonb
    LOOP
        -- 초기 choices_pricing 구조 생성
        choices_pricing := '{}'::jsonb;
        
        -- 상품의 choices 정보 가져오기
        product_choices := rec.choices;
        
        IF product_choices IS NOT NULL AND product_choices ? 'required' THEN
            -- 각 필수 초이스에 대해 처리
            FOR choice_item IN 
                SELECT * FROM jsonb_array_elements(product_choices->'required')
            LOOP
                choice_id := choice_item.value->>'id';
                choices_pricing := choices_pricing || jsonb_build_object(
                    choice_id, jsonb_build_object(
                        'options', '{}'::jsonb
                    )
                );
                
                -- options_pricing의 각 옵션을 choices_pricing으로 변환
                IF jsonb_typeof(rec.options_pricing) = 'array' THEN
                    -- 배열 형태의 options_pricing 처리
                    FOR option_item IN 
                        SELECT * FROM jsonb_array_elements(rec.options_pricing)
                    LOOP
                        option_id := option_item.value->>'option_id';
                        option_price := COALESCE((option_item.value->>'adult_price')::numeric, 0);
                        
                        -- option_id를 기반으로 choice option 찾기
                        -- 실제 구현에서는 option_id와 choice option의 매핑 로직이 필요
                        -- 여기서는 간단히 첫 번째 옵션에 매핑
                        FOR choice_option IN 
                            SELECT * FROM jsonb_array_elements(choice_item.value->'options')
                        LOOP
                            -- 가격 정보 추가
                            choice_option := choice_option.value || jsonb_build_object(
                                'adult_price', option_price,
                                'child_price', COALESCE((option_item.value->>'child_price')::numeric, option_price),
                                'infant_price', COALESCE((option_item.value->>'infant_price')::numeric, option_price)
                            );
                            
                            -- choices_pricing에 추가
                            choices_pricing := jsonb_set(
                                choices_pricing,
                                ARRAY[choice_id, 'options', choice_option->>'id'],
                                choice_option
                            );
                        END LOOP;
                    END LOOP;
                ELSIF jsonb_typeof(rec.options_pricing) = 'object' THEN
                    -- 객체 형태의 options_pricing 처리
                    FOR option_item IN 
                        SELECT * FROM jsonb_each(rec.options_pricing)
                    LOOP
                        option_id := option_item.key;
                        option_price := COALESCE((option_item.value->>'adult_price')::numeric, 0);
                        
                        -- choice option 찾기 및 가격 설정
                        FOR choice_option IN 
                            SELECT * FROM jsonb_array_elements(choice_item.value->'options')
                        LOOP
                            choice_option := choice_option.value || jsonb_build_object(
                                'adult_price', option_price,
                                'child_price', COALESCE((option_item.value->>'child_price')::numeric, option_price),
                                'infant_price', COALESCE((option_item.value->>'infant_price')::numeric, option_price)
                            );
                            
                            choices_pricing := jsonb_set(
                                choices_pricing,
                                ARRAY[choice_id, 'options', choice_option->>'id'],
                                choice_option
                            );
                        END LOOP;
                    END LOOP;
                END IF;
            END LOOP;
        END IF;
        
        -- dynamic_pricing 업데이트
        UPDATE dynamic_pricing 
        SET 
            choices_pricing = choices_pricing,
            updated_at = NOW()
        WHERE product_id = rec.product_id 
        AND channel_id = rec.channel_id 
        AND date = rec.date;
        
        RETURN QUERY SELECT 
            rec.product_id,
            rec.channel_id,
            rec.date,
            rec.options_pricing,
            choices_pricing,
            TRUE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. MDGCSUNRISE 상품의 dynamic_pricing 데이터를 choices 시스템으로 변환
-- 기존 options_pricing: [{"option_id": "d36f71c0-47c6-41e1-b1aa-2e853a8eb1e0", "adult_price": 351, ...}]
-- 새로운 choices_pricing: {"canyon_choice": {"options": {"antelope_lower": {"adult_price": 351, ...}}}}

UPDATE dynamic_pricing 
SET choices_pricing = '{
  "canyon_choice": {
    "options": {
      "antelope_lower": {
        "id": "antelope_lower",
        "name": "Lower Antelope Canyon",
        "name_ko": "로어 앤텔로프 캐년",
        "adult_price": 351,
        "child_price": 351,
        "infant_price": 351
      },
      "antelope_x": {
        "id": "antelope_x", 
        "name": "Antelope X Canyon",
        "name_ko": "앤텔로프 X 캐년",
        "adult_price": 384,
        "child_price": 384,
        "infant_price": 384
      }
    }
  }
}'::jsonb
WHERE product_id = 'MDGCSUNRISE'
AND choices_pricing IS NULL;

-- 4. choices_pricing 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_choices_pricing 
ON dynamic_pricing USING GIN (choices_pricing);

-- 5. 기존 options_pricing과 choices_pricing의 매핑을 위한 뷰 생성
CREATE OR REPLACE VIEW dynamic_pricing_choices_view AS
SELECT 
    dp.product_id,
    dp.channel_id,
    dp.date,
    dp.adult_price,
    dp.child_price,
    dp.infant_price,
    dp.commission_percent,
    dp.choices_pricing,
    choice_data.key as choice_id,
    choice_data.value->>'name' as choice_name,
    option_data.key as option_id,
    option_data.value->>'name' as option_name,
    option_data.value->>'name_ko' as option_name_ko,
    (option_data.value->>'adult_price')::numeric as option_adult_price,
    (option_data.value->>'child_price')::numeric as option_child_price,
    (option_data.value->>'infant_price')::numeric as option_infant_price
FROM dynamic_pricing dp,
     jsonb_each(dp.choices_pricing) as choice_data,
     jsonb_each(choice_data.value->'options') as option_data
WHERE dp.choices_pricing IS NOT NULL
AND choice_data.value ? 'options';

-- 6. 마이그레이션 실행 (주석 해제하여 실행)
-- SELECT * FROM migrate_dynamic_pricing_to_choices();

-- 7. 결과 확인을 위한 쿼리
-- SELECT 
--     product_id,
--     channel_id,
--     date,
--     choices_pricing,
--     COUNT(*) as option_count
-- FROM dynamic_pricing_choices_view
-- WHERE product_id = 'MDGCSUNRISE'
-- GROUP BY product_id, channel_id, date, choices_pricing
-- ORDER BY product_id, channel_id, date;
