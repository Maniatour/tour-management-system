-- 자동 투어 생성 함수 수정 - UUID를 TEXT로 변경
-- Migration: 20250101000119_fix_auto_tour_creation_function

CREATE OR REPLACE FUNCTION auto_create_or_update_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_sub_category TEXT;
    existing_tour_id TEXT;
    new_tour_id TEXT;
BEGIN
    -- 예약이 생성된 후 실행되므로 NEW 레코드 사용
    -- 해당 상품의 sub_category 확인
    SELECT sub_category INTO product_sub_category
    FROM products 
    WHERE id = NEW.product_id;
    
    -- sub_category가 'Mania Tour' 또는 'Mania Service'인 경우에만 처리
    IF product_sub_category IN ('Mania Tour', 'Mania Service') THEN
        -- 같은 날짜, 같은 product_id의 기존 투어가 있는지 확인
        SELECT id INTO existing_tour_id
        FROM tours 
        WHERE product_id = NEW.product_id 
        AND tour_date = NEW.tour_date
        LIMIT 1;
        
        IF existing_tour_id IS NOT NULL THEN
            -- 기존 투어가 있는 경우: reservation_ids에 새 예약 ID 추가
            UPDATE tours 
            SET reservation_ids = array_append(reservation_ids, NEW.id)
            WHERE id = existing_tour_id;
            
            -- reservations 테이블의 tour_id 업데이트
            UPDATE reservations 
            SET tour_id = existing_tour_id
            WHERE id = NEW.id;
            
        ELSE
            -- 기존 투어가 없는 경우: 새 투어 생성
            INSERT INTO tours (
                product_id,
                tour_date,
                reservation_ids,
                tour_status
            ) VALUES (
                NEW.product_id,
                NEW.tour_date,
                ARRAY[NEW.id],
                'scheduled'
            ) RETURNING id INTO new_tour_id;
            
            -- reservations 테이블의 tour_id 업데이트
            UPDATE reservations 
            SET tour_id = new_tour_id
            WHERE id = NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
