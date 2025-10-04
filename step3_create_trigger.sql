-- Step 3: 트리거 생성
-- 채팅방 생성 함수를 영문으로 업데이트 - 3단계

CREATE TRIGGER trigger_create_chat_room_on_tour_insert
    AFTER INSERT ON tours
    FOR EACH ROW
    WHEN (NEW.tour_status IN ('Recruiting', 'Confirmed'))
    EXECUTE FUNCTION create_chat_room_for_tour();

-- 함수 설명 추가
COMMENT ON FUNCTION create_chat_room_for_tour() IS 'Create English chat room automatically when tour is created';
