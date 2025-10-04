-- 채팅방 생성 함수를 영문으로 업데이트
-- Migration: Update chat room creation function to English

-- 1. 기존 함수 삭제
DROP FUNCTION IF EXISTS create_chat_room_for_tour();

-- 2. 영문 버전으로 새 함수 생성
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

-- 3. 투어 생성 시 트리거 활성화
DROP TRIGGER IF EXISTS trigger_create_chat_room_on_tour_insert ON tours;
CREATE TRIGGER trigger_create_chat_room_on_tour_insert
    AFTER INSERT ON tours
    FOR EACH ROW
    WHEN (NEW.tour_status IN ('Recruiting', 'Confirmed'))
    EXECUTE FUNCTION create_chat_room_for_tour();

-- 4. 함수 설명
COMMENT ON FUNCTION create_chat_room_for_tour() IS 'Create English chat room automatically when tour is created';

-- 5. 테스트를 위한 함수 (선택사항)
CREATE OR REPLACE FUNCTION test_chat_room_creation(tour_id_val TEXT)
RETURNS TEXT AS $$
DECLARE
    result_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM chat_rooms
    WHERE tour_id = tour_id_val;
    
    RETURN 'Chat rooms for tour ' || tour_id_val || ': ' || result_count;
END;
$$ LANGUAGE plpgsql;

-- 6. 결과 확인 쿼리
-- 최근 생성된 채팅방들을 확인
SELECT 
    cr.id,
    cr.tour_id,
    cr.room_name,
    cr.room_code,
    cr.description,
    cr.created_at,
    t.tour_date,
    p.name_en as product_name_en,
    p.name_ko as product_name_ko
FROM chat_rooms cr
LEFT JOIN tours t ON cr.tour_id = t.id
LEFT JOIN products p ON t.product_id = p.id
ORDER BY cr.created_at DESC
LIMIT 10;
