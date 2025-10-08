-- 기존 reservation_pricing 데이터를 choices 시스템으로 마이그레이션
-- 이 스크립트는 기존 required_options 데이터를 choices 형식으로 변환합니다

-- 1. 마이그레이션 함수 생성
CREATE OR REPLACE FUNCTION migrate_reservation_pricing_to_choices_v2()
RETURNS TABLE(
    reservation_id TEXT,
    old_required_options JSONB,
    old_required_option_total DECIMAL(10,2),
    new_choices JSONB,
    new_choices_total DECIMAL(10,2),
    migration_status TEXT
) AS $$
DECLARE
    rec RECORD;
    choices_data JSONB;
    choices_total DECIMAL(10,2);
    reservation_data RECORD;
    option_entry RECORD;
    choice_entry JSONB;
BEGIN
    FOR rec IN 
        SELECT 
            rp.reservation_id,
            rp.required_options,
            rp.required_option_total,
            r.adults,
            r.child,
            r.infant,
            r.choices as reservation_choices
        FROM reservation_pricing rp
        JOIN reservations r ON rp.reservation_id = r.id
        WHERE rp.required_options IS NOT NULL 
        AND rp.required_options != '{}'::jsonb
        ORDER BY rp.reservation_id
    LOOP
        choices_data := '{}'::jsonb;
        choices_total := 0;
        
        -- reservations 테이블의 choices가 있으면 우선 사용
        IF rec.reservation_choices IS NOT NULL AND rec.reservation_choices != '{}'::jsonb THEN
            choices_data := rec.reservation_choices;
            
            -- choices_total 계산
            FOR option_entry IN 
                SELECT key, value 
                FROM jsonb_each(rec.reservation_choices)
            LOOP
                IF jsonb_typeof(option_entry.value) = 'object' THEN
                    choice_entry := option_entry.value;
                    
                    -- 각 choice의 가격 계산
                    choices_total := choices_total + 
                        COALESCE((choice_entry->>'adult_price')::DECIMAL(10,2), 0) * rec.adults +
                        COALESCE((choice_entry->>'child_price')::DECIMAL(10,2), 0) * rec.child +
                        COALESCE((choice_entry->>'infant_price')::DECIMAL(10,2), 0) * rec.infant;
                END IF;
            END LOOP;
            
            -- reservation_pricing 업데이트
            UPDATE reservation_pricing 
            SET 
                choices = choices_data,
                choices_total = choices_total,
                updated_at = NOW()
            WHERE reservation_id = rec.reservation_id;
            
            RETURN QUERY SELECT 
                rec.reservation_id,
                rec.required_options,
                rec.required_option_total,
                choices_data,
                choices_total,
                'MIGRATED_FROM_RESERVATION_CHOICES'::TEXT;
                
        ELSE
            -- reservations에 choices가 없으면 required_options를 변환
            -- 이 경우는 기존 데이터 구조를 유지하되 choices 컬럼에 복사
            choices_data := rec.required_options;
            choices_total := rec.required_option_total;
            
            -- reservation_pricing 업데이트
            UPDATE reservation_pricing 
            SET 
                choices = choices_data,
                choices_total = choices_total,
                updated_at = NOW()
            WHERE reservation_id = rec.reservation_id;
            
            RETURN QUERY SELECT 
                rec.reservation_id,
                rec.required_options,
                rec.required_option_total,
                choices_data,
                choices_total,
                'COPIED_FROM_REQUIRED_OPTIONS'::TEXT;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 2. 마이그레이션 실행
SELECT * FROM migrate_reservation_pricing_to_choices_v2();

-- 3. 마이그레이션 결과 확인
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN choices IS NOT NULL AND choices != '{}'::jsonb THEN 1 END) as records_with_choices,
    COUNT(CASE WHEN choices_total > 0 THEN 1 END) as records_with_choices_total,
    AVG(choices_total) as avg_choices_total
FROM reservation_pricing;

-- 4. 샘플 데이터 확인
SELECT 
    reservation_id,
    required_options,
    required_option_total,
    choices,
    choices_total,
    subtotal
FROM reservation_pricing 
WHERE choices IS NOT NULL 
AND choices != '{}'::jsonb
LIMIT 5;

-- 5. 마이그레이션 함수 정리
DROP FUNCTION IF EXISTS migrate_reservation_pricing_to_choices_v2();

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_reservation_pricing_choices_total 
ON reservation_pricing (choices_total) 
WHERE choices_total > 0;

-- 7. 선택사항: 기존 컬럼들을 NULL로 설정 (데이터는 보존하되 사용하지 않음)
-- 주의: 이 작업은 되돌릴 수 없으므로 신중하게 결정하세요
-- UPDATE reservation_pricing SET required_options = NULL, required_option_total = NULL;

-- 8. 마이그레이션 완료 로그
INSERT INTO sync_logs (table_name, operation, status, message, created_at)
VALUES (
    'reservation_pricing', 
    'migrate_to_choices', 
    'completed', 
    'Successfully migrated reservation_pricing data to use choices system',
    NOW()
) ON CONFLICT DO NOTHING;
