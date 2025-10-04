-- Step 2: 영문 버전으로 새 함수 생성
-- 채팅방 생성 함수를 영문으로 업데이트 - 2단계

CREATE OR REPLACE FUNCTION create_chat_room_for_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_name_en TEXT;
    product_name_ko TEXT;
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
    
    -- 상품명 가져오기 (영문 우선, 없으면 한글 사용)
    SELECT name_en, name_ko INTO product_name_en, product_name_ko
    FROM products
    WHERE id = NEW.product_id;
    
    -- 상품명이 없으면 기본값 사용
    IF product_name_en IS NULL AND product_name_ko IS NULL THEN
        product_name_en := 'Tour';
    ELSIF product_name_en IS NULL THEN
        product_name_en := product_name_ko; -- 영문이 없으면 한글 사용
    END IF;
    
    -- 고유한 채팅방 코드 생성 (투어 ID + 랜덤 문자열)
    room_code := 'TOUR_' || NEW.id || '_' || substr(md5(random()::text), 1, 8);
    
    -- 채팅방 생성 (영문 템플릿 사용)
    INSERT INTO chat_rooms (
        tour_id,
        room_name,
        room_code,
        description,
        created_by
    ) VALUES (
        NEW.id,
        'Tour Chat Room - ' || product_name_en,
        room_code,
        'Tour Date: ' || NEW.tour_date || ' - ' || product_name_en || ' related communication room.',
        'system'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
