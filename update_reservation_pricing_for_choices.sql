-- reservation_pricing 테이블을 choices 시스템에 맞게 업데이트
-- 기존 required_options와 required_option_total을 choices 기반으로 변경

-- 1. reservation_pricing 테이블에 choices 관련 컬럼 추가
ALTER TABLE reservation_pricing 
ADD COLUMN IF NOT EXISTS choices JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS choices_total DECIMAL(10,2) DEFAULT 0.00;

-- 2. choices 컬럼에 대한 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_reservation_pricing_choices 
ON reservation_pricing USING gin (choices);

-- 3. 기존 데이터 마이그레이션 함수 생성
CREATE OR REPLACE FUNCTION migrate_reservation_pricing_to_choices()
RETURNS TABLE(
    reservation_id TEXT,
    old_required_options JSONB,
    old_required_option_total DECIMAL(10,2),
    new_choices JSONB,
    new_choices_total DECIMAL(10,2),
    updated BOOLEAN
) AS $$
DECLARE
    rec RECORD;
    choices_data JSONB;
    choices_total DECIMAL(10,2);
    reservation_data RECORD;
BEGIN
    FOR rec IN 
        SELECT 
            rp.reservation_id,
            rp.required_options,
            rp.required_option_total,
            r.choices,
            r.adults,
            r.child,
            r.infant
        FROM reservation_pricing rp
        JOIN reservations r ON rp.reservation_id = r.id
        WHERE rp.required_options IS NOT NULL 
        AND rp.required_options != '{}'::jsonb
    LOOP
        -- reservations 테이블의 choices 데이터를 사용
        choices_data := rec.choices;
        
        -- choices_total 계산 (기존 로직과 동일하게)
        choices_total := 0;
        
        -- choices 데이터가 있는 경우 계산
        IF choices_data IS NOT NULL AND choices_data != '{}'::jsonb THEN
            -- choices에서 각 선택된 옵션의 가격을 계산
            -- 이 부분은 실제 choices 구조에 따라 조정 필요
            SELECT COALESCE(SUM(
                CASE 
                    WHEN jsonb_typeof(value) = 'object' THEN
                        COALESCE((value->>'adult_price')::DECIMAL(10,2), 0) * rec.adults +
                        COALESCE((value->>'child_price')::DECIMAL(10,2), 0) * rec.child +
                        COALESCE((value->>'infant_price')::DECIMAL(10,2), 0) * rec.infant
                    ELSE 0
                END
            ), 0) INTO choices_total
            FROM jsonb_each(choices_data);
        END IF;
        
        -- reservation_pricing 업데이트
        UPDATE reservation_pricing 
        SET 
            choices = choices_data,
            choices_total = choices_total,
            updated_at = NOW()
        WHERE reservation_id = rec.reservation_id;
        
        -- 결과 반환
        RETURN QUERY SELECT 
            rec.reservation_id,
            rec.required_options,
            rec.required_option_total,
            choices_data,
            choices_total,
            TRUE;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. 마이그레이션 실행
SELECT * FROM migrate_reservation_pricing_to_choices();

-- 5. 기존 컬럼들을 deprecated로 표시 (나중에 제거할 수 있도록)
COMMENT ON COLUMN reservation_pricing.required_options IS 'DEPRECATED: Use choices column instead';
COMMENT ON COLUMN reservation_pricing.required_option_total IS 'DEPRECATED: Use choices_total column instead';

-- 6. 새로운 컬럼들에 대한 설명 추가
COMMENT ON COLUMN reservation_pricing.choices IS 'Selected choices with pricing information (replaces required_options)';
COMMENT ON COLUMN reservation_pricing.choices_total IS 'Total price for selected choices (replaces required_option_total)';

-- 7. 선택사항: 기존 컬럼들을 NULL로 설정 (데이터는 보존하되 사용하지 않음)
-- UPDATE reservation_pricing SET required_options = NULL, required_option_total = NULL;

-- 8. 마이그레이션 함수 정리
DROP FUNCTION IF EXISTS migrate_reservation_pricing_to_choices();
