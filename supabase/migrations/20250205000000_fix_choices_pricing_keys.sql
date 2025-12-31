-- 초이스 구조 변경 문제 해결
-- choices_pricing 키를 안정적인 식별자(choice_group_key + option_key)로 변환

-- 1. dynamic_pricing.choices_pricing 키 변환 함수
CREATE OR REPLACE FUNCTION migrate_choices_pricing_keys()
RETURNS TABLE(
    product_id TEXT,
    channel_id TEXT,
    date DATE,
    old_keys_count INTEGER,
    new_keys_count INTEGER,
    migrated BOOLEAN
) AS $$
DECLARE
    rec RECORD;
    choices_pricing_data JSONB;
    new_choices_pricing JSONB;
    old_key TEXT;
    new_key TEXT;
    key_parts TEXT[];
    choice_id_from_key UUID;
    option_key_from_key TEXT;
    choice_group_key_found TEXT;
    option_key_found TEXT;
    pricing_value JSONB;
    keys_migrated INTEGER;
    keys_failed INTEGER;
BEGIN
    FOR rec IN 
        SELECT 
            dp.product_id,
            dp.channel_id,
            dp.date,
            dp.choices_pricing
        FROM dynamic_pricing dp
        WHERE dp.choices_pricing IS NOT NULL
          AND dp.choices_pricing != '{}'::jsonb
    LOOP
        choices_pricing_data := rec.choices_pricing;
        new_choices_pricing := '{}'::jsonb;
        keys_migrated := 0;
        keys_failed := 0;

        -- 각 키를 순회하면서 변환
        FOR old_key, pricing_value IN SELECT * FROM jsonb_each(choices_pricing_data)
        LOOP
            -- 키 형식: {choice_id}+option_1 또는 {choice_id}+{option_key}
            key_parts := string_to_array(old_key, '+');
            
            IF array_length(key_parts, 1) = 2 THEN
                -- choice_id 추출
                BEGIN
                    choice_id_from_key := key_parts[1]::UUID;
                    
                    -- product_choices에서 choice_group_key 찾기
                    SELECT pc.choice_group_key INTO choice_group_key_found
                    FROM product_choices pc
                    WHERE pc.id = choice_id_from_key
                    LIMIT 1;
                    
                    -- option_key 찾기
                    -- 방법 1: 키의 두 번째 부분이 option_key인 경우
                    IF key_parts[2] LIKE 'option_%' THEN
                        -- option_1, option_2 형식인 경우, choice_options에서 순서로 찾기
                        DECLARE
                            option_index INTEGER;
                            found_option_key TEXT;
                        BEGIN
                            option_index := substring(key_parts[2] FROM 'option_(\d+)')::INTEGER;
                            
                            SELECT co.option_key INTO found_option_key
                            FROM choice_options co
                            WHERE co.choice_id = choice_id_from_key
                            ORDER BY co.sort_order, co.created_at
                            OFFSET (option_index - 1)
                            LIMIT 1;
                            
                            IF found_option_key IS NOT NULL THEN
                                option_key_found := found_option_key;
                            ELSE
                                -- 순서로 찾지 못하면 첫 번째 옵션 사용
                                SELECT co.option_key INTO option_key_found
                                FROM choice_options co
                                WHERE co.choice_id = choice_id_from_key
                                ORDER BY co.sort_order, co.created_at
                                LIMIT 1;
                            END IF;
                        END;
                    ELSE
                        -- 이미 option_key인 경우
                        option_key_found := key_parts[2];
                    END IF;
                    
                    -- choice_group_key와 option_key가 모두 있으면 새 키 생성
                    IF choice_group_key_found IS NOT NULL AND option_key_found IS NOT NULL THEN
                        new_key := choice_group_key_found || '+' || option_key_found;
                        new_choices_pricing := new_choices_pricing || jsonb_build_object(new_key, pricing_value);
                        keys_migrated := keys_migrated + 1;
                    ELSE
                        -- 매칭 실패 시 기존 키 유지
                        new_choices_pricing := new_choices_pricing || jsonb_build_object(old_key, pricing_value);
                        keys_failed := keys_failed + 1;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    -- UUID 변환 실패 등 오류 시 기존 키 유지
                    new_choices_pricing := new_choices_pricing || jsonb_build_object(old_key, pricing_value);
                    keys_failed := keys_failed + 1;
                END;
            ELSE
                -- 키 형식이 예상과 다르면 기존 키 유지
                new_choices_pricing := new_choices_pricing || jsonb_build_object(old_key, pricing_value);
                keys_failed := keys_failed + 1;
            END IF;
        END LOOP;

        -- 변환된 데이터로 업데이트
        IF keys_migrated > 0 THEN
            UPDATE dynamic_pricing
            SET choices_pricing = new_choices_pricing,
                updated_at = NOW()
            WHERE dynamic_pricing.product_id = rec.product_id
              AND dynamic_pricing.channel_id = rec.channel_id
              AND dynamic_pricing.date = rec.date;
        END IF;

        RETURN QUERY SELECT 
            rec.product_id,
            rec.channel_id,
            rec.date,
            (SELECT COUNT(*)::INTEGER FROM jsonb_object_keys(choices_pricing_data) AS key),
            keys_migrated,
            (keys_migrated > 0)::BOOLEAN;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. 마이그레이션 실행 (주의: 실제 실행 전에 백업 필요)
-- SELECT * FROM migrate_choices_pricing_keys();

-- 3. 향후 choices_pricing 저장 시 안정적인 식별자 사용하도록 함수 생성
CREATE OR REPLACE FUNCTION build_choices_pricing_key(
    p_choice_group_key TEXT,
    p_option_key TEXT
)
RETURNS TEXT AS $$
BEGIN
    RETURN p_choice_group_key || '+' || p_option_key;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. 코멘트 추가
COMMENT ON FUNCTION migrate_choices_pricing_keys() IS 
'기존 choices_pricing 키를 안정적인 식별자(choice_group_key + option_key)로 변환';

COMMENT ON FUNCTION build_choices_pricing_key(TEXT, TEXT) IS 
'choices_pricing 키를 안정적인 식별자로 생성';

-- 5. (선택사항) 초이스 저장 시 기존 초이스 삭제 대신 is_active 플래그 사용
-- product_choices에 is_active 컬럼이 없으면 추가
ALTER TABLE product_choices 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 기존 모든 초이스를 활성화 상태로 설정
UPDATE product_choices 
SET is_active = true 
WHERE is_active IS NULL;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_product_choices_is_active 
ON product_choices(product_id, is_active) 
WHERE is_active = true;

COMMENT ON COLUMN product_choices.is_active IS 
'초이스 활성화 여부. false인 경우 기존 데이터와의 호환성을 위해 보존되지만 새로운 예약에서는 사용되지 않음';

