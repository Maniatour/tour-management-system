-- vehicle_number 생성 함수 개선
CREATE OR REPLACE FUNCTION generate_unique_vehicle_number()
RETURNS TEXT AS $$
DECLARE
    new_number TEXT;
    counter INTEGER := 1;
BEGIN
    LOOP
        -- 현재 날짜 + 시간 + 카운터로 고유 번호 생성
        new_number := 'V' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(counter::TEXT, 3, '0');
        
        -- 중복 확인
        IF NOT EXISTS (SELECT 1 FROM vehicles WHERE vehicle_number = new_number) THEN
            RETURN new_number;
        END IF;
        
        counter := counter + 1;
        
        -- 무한 루프 방지
        IF counter > 999 THEN
            RAISE EXCEPTION 'Unable to generate unique vehicle number';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- vehicles 테이블의 기본값을 함수로 변경
ALTER TABLE vehicles ALTER COLUMN vehicle_number SET DEFAULT generate_unique_vehicle_number();
