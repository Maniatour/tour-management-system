-- 채팅방 생성 함수 수정 - UUID를 TEXT로 변경
-- Migration: 20250101000120_fix_chat_room_creation_function

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
    
    -- 채팅방이 이미 있으면 생성하지 않음
    IF existing_room_count > 0 THEN
        RETURN NEW;
    END IF;
    
    -- 상품명 가져오기
    SELECT name_ko INTO product_name
    FROM products
    WHERE id = NEW.product_id;
    
    -- 상품명이 없으면 기본값 사용
    IF product_name IS NULL THEN
        product_name := '투어';
    END IF;
    
    -- 고유한 채팅방 코드 생성 (투어 ID + 랜덤 문자열)
    room_code := 'TOUR_' || NEW.id || '_' || substr(md5(random()::text), 1, 8);
    
    -- 채팅방 생성
    INSERT INTO chat_rooms (
        tour_id,
        room_name,
        room_code,
        description,
        created_by
    ) VALUES (
        NEW.id,
        product_name || ' 채팅방',
        room_code,
        product_name || ' 투어 관련 문의사항을 남겨주세요.',
        'system'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
