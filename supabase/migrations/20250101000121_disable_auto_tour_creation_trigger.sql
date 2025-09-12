-- 투어 자동 생성 트리거 비활성화
-- Migration: 20250101000121_disable_auto_tour_creation_trigger

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS auto_create_tour_trigger ON reservations;

-- 함수는 유지하되 트리거만 비활성화
-- 나중에 시스템 사용 시작할 때 다시 활성화 가능
