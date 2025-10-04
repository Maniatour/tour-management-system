-- Step 1: 기존 함수와 트리거 삭제
-- 채팅방 생성 함수를 영문으로 업데이트 - 1단계

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS create_chat_room_for_tour();

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS trigger_create_chat_room_on_tour_insert ON tours;
