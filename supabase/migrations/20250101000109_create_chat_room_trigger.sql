-- 투어 생성 시 자동으로 채팅방을 생성하는 트리거
-- Migration: 20250101000109_create_chat_room_trigger

-- 1. 채팅방 생성 함수 생성
CREATE OR REPLACE FUNCTION create_chat_room_for_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_name TEXT;
    room_code TEXT;
    existing_room_count INTEGER;
BEGIN
    -- 이미 해당 투어에 대한 채팅방이 있는지 확인
    SELECT COUNT(*) INTO existing_room_count
    FROM chat_rooms
    WHERE tour_id = NEW.id;
    
    -- 이미 채팅방이 있으면 생성하지 않음
    IF existing_room_count > 0 THEN
        RETURN NEW;
    END IF;
    
    -- 상품명 가져오기
    SELECT name INTO product_name
    FROM products
    WHERE id = NEW.product_id;
    
    -- 6자리 랜덤 코드 생성
    room_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
    
    -- 채팅방 생성
    INSERT INTO chat_rooms (
        tour_id,
        room_name,
        room_code,
        description,
        is_active,
        created_by
    ) VALUES (
        NEW.id,
        CONCAT('투어 채팅방 - ', COALESCE(product_name, '상품명 없음')),
        room_code,
        CONCAT('투어 날짜: ', NEW.tour_date, ' - ', COALESCE(product_name, '상품명 없음'), ' 투어 관련 소통을 위한 채팅방입니다.'),
        true,
        'admin@kovegas.com'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 투어 생성 시 트리거 활성화
CREATE TRIGGER trigger_create_chat_room_on_tour_insert
    AFTER INSERT ON tours
    FOR EACH ROW
    WHEN (NEW.tour_status IN ('Recruiting', 'Confirmed'))
    EXECUTE FUNCTION create_chat_room_for_tour();

-- 3. 투어 상태 변경 시 채팅방 활성화/비활성화
CREATE OR REPLACE FUNCTION update_chat_room_status()
RETURNS TRIGGER AS $$
BEGIN
    -- 투어 상태가 Recruiting 또는 Confirmed로 변경되면 채팅방 활성화
    IF NEW.tour_status IN ('Recruiting', 'Confirmed') THEN
        UPDATE chat_rooms 
        SET is_active = true
        WHERE tour_id = NEW.id;
    -- 다른 상태로 변경되면 채팅방 비활성화
    ELSIF OLD.tour_status IN ('Recruiting', 'Confirmed') AND NEW.tour_status NOT IN ('Recruiting', 'Confirmed') THEN
        UPDATE chat_rooms 
        SET is_active = false
        WHERE tour_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 투어 상태 변경 시 트리거 활성화
CREATE TRIGGER trigger_update_chat_room_on_tour_status_change
    AFTER UPDATE ON tours
    FOR EACH ROW
    WHEN (OLD.tour_status IS DISTINCT FROM NEW.tour_status)
    EXECUTE FUNCTION update_chat_room_status();

