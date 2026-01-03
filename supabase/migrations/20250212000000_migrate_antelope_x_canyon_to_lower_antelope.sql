-- 선택 사항 마이그레이션: Antelope X Canyon을 Lower Antelope Canyon으로 변경
-- reservations 테이블의 selected_options 컬럼에서
-- 3a842aec-a3c3-4516-b846-13fed5dd95b8 (Antelope X Canyon)를
-- 8aab7091-b636-4426-9c1e-df37ed7d6538 (Lower Antelope Canyon)로 변경
-- 작성일: 2025-02-12

DO $$
DECLARE
    old_option_id TEXT := '3a842aec-a3c3-4516-b846-13fed5dd95b8';
    new_option_id TEXT := '8aab7091-b636-4426-9c1e-df37ed7d6538';
    rec RECORD;
    updated_options JSONB;
    old_value JSONB;
    new_value JSONB;
    existing_value JSONB;
    merged_value JSONB;
    updated_count INTEGER := 0;
BEGIN
    -- selected_options에 old_option_id가 키로 있는 모든 예약을 찾아서 업데이트
    FOR rec IN 
        SELECT id, selected_options
        FROM reservations
        WHERE selected_options IS NOT NULL
        AND selected_options ? old_option_id
    LOOP
        -- JSONB 객체 복사
        updated_options := rec.selected_options;
        
        -- old_option_id 키의 값을 가져옴
        old_value := updated_options -> old_option_id;
        
        -- 배열 내의 old_option_id를 new_option_id로 변경
        IF jsonb_typeof(old_value) = 'array' THEN
            new_value := (
                SELECT jsonb_agg(
                    CASE 
                        WHEN elem::text = '"' || old_option_id || '"' THEN 
                            to_jsonb(new_option_id)
                        ELSE 
                            elem
                    END
                )
                FROM jsonb_array_elements(old_value) AS elem
            );
        ELSE
            new_value := old_value;
        END IF;
        
        -- old_option_id 키 제거
        updated_options := updated_options - old_option_id;
        
        -- new_option_id 키가 이미 있으면 값 병합, 없으면 추가
        IF updated_options ? new_option_id THEN
            -- 기존 값과 병합 (배열 합치기)
            existing_value := updated_options -> new_option_id;
            IF jsonb_typeof(existing_value) = 'array' AND jsonb_typeof(new_value) = 'array' THEN
                -- 두 배열 합치기 (중복 제거)
                merged_value := (
                    SELECT jsonb_agg(DISTINCT elem)
                    FROM (
                        SELECT elem FROM jsonb_array_elements(existing_value) AS elem
                        UNION
                        SELECT elem FROM jsonb_array_elements(new_value) AS elem
                    ) AS combined
                );
            ELSIF jsonb_typeof(new_value) = 'array' THEN
                merged_value := new_value;
            ELSE
                merged_value := existing_value;
            END IF;
            updated_options := jsonb_set(updated_options, ARRAY[new_option_id], merged_value);
        ELSE
            -- 새 키 추가
            updated_options := jsonb_set(updated_options, ARRAY[new_option_id], new_value);
        END IF;
        
        -- 모든 키의 배열 값에서 old_option_id를 new_option_id로 변경
        updated_options := (
            SELECT jsonb_object_agg(
                key,
                CASE 
                    WHEN jsonb_typeof(value) = 'array' THEN
                        (
                            SELECT jsonb_agg(
                                CASE 
                                    WHEN elem::text = '"' || old_option_id || '"' THEN 
                                        to_jsonb(new_option_id)
                                    ELSE 
                                        elem
                                END
                            )
                            FROM jsonb_array_elements(value) AS elem
                        )
                    ELSE 
                        value
                END
            )
            FROM jsonb_each(updated_options)
        );
        
        -- 예약 업데이트
        UPDATE reservations
        SET 
            selected_options = updated_options,
            updated_at = NOW()
        WHERE id = rec.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RAISE NOTICE '총 %개의 예약이 업데이트되었습니다.', updated_count;
END $$;

-- 마이그레이션 결과 확인
SELECT 
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE selected_options ? '3a842aec-a3c3-4516-b846-13fed5dd95b8') as still_has_old_id,
    COUNT(*) FILTER (WHERE selected_options ? '8aab7091-b636-4426-9c1e-df37ed7d6538') as has_new_id
FROM reservations
WHERE selected_options IS NOT NULL;

