-- import를 위해 임시로 unique constraint 비활성화
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_vehicle_number_key;

-- import 후에 실행할 중복 처리 함수
CREATE OR REPLACE FUNCTION fix_duplicate_vehicle_numbers()
RETURNS void AS $$
DECLARE
    rec RECORD;
    counter INTEGER;
BEGIN
    -- 중복된 vehicle_number 처리
    FOR rec IN 
        SELECT vehicle_number, array_agg(id ORDER BY created_at) as ids
        FROM vehicles 
        GROUP BY vehicle_number 
        HAVING COUNT(*) > 1
    LOOP
        counter := 1;
        -- 첫 번째는 그대로 두고, 나머지는 접미사 추가
        FOR i IN 2..array_length(rec.ids, 1) LOOP
            UPDATE vehicles 
            SET vehicle_number = rec.vehicle_number || '_' || counter
            WHERE id = rec.ids[i];
            counter := counter + 1;
        END LOOP;
    END LOOP;
    
    -- unique constraint 다시 추가
    ALTER TABLE vehicles ADD CONSTRAINT vehicles_vehicle_number_key UNIQUE (vehicle_number);
END;
$$ LANGUAGE plpgsql;
