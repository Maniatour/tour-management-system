-- 투어는 앱에서 주로 tour_status = 'scheduled' 로 생성되나,
-- 기존 INSERT 트리거는 Recruiting/Confirmed 일 때만 채팅방을 만들어 누락이 다수 발생함.
-- 1) 채팅방 없는 기존 투어 일괄 보정
-- 2) 이후 모든 투어 INSERT 시 트리거로 채팅방 생성 (create_chat_room_for_tour 는 20251225000001 버전 유지)
-- 3) scheduled 도 "진행 투어"로 취급해 상태 변경 시 채팅방 활성 플래그 일관 처리

-- ---------------------------------------------------------------------------
-- 기존 투어 중 chat_rooms 가 없는 행에 채팅방 추가
-- ---------------------------------------------------------------------------
INSERT INTO public.chat_rooms (
  tour_id,
  room_name,
  room_code,
  description,
  is_active,
  created_by
)
SELECT
  t.id,
  COALESCE(p.name_ko, '투어') || ' 채팅방',
  'TOUR_' || t.id || '_' || substr(md5(random()::text || t.id::text || clock_timestamp()::text), 1, 8),
  COALESCE(p.name_ko, '투어') || ' 투어 관련 문의사항을 남겨주세요.',
  true,
  'system'
FROM public.tours t
LEFT JOIN public.products p ON p.id = t.product_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_rooms cr WHERE cr.tour_id = t.id
);

-- 새로 생긴 방(및 과거에 공지가 비어 있던 방)에 기본 공지 — 기존 함수 재사용
SELECT public.add_default_announcements_to_existing_rooms();

-- ---------------------------------------------------------------------------
-- INSERT 트리거: 모든 상태의 신규 투어에 대해 채팅방 생성
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_create_chat_room_on_tour_insert ON public.tours;

CREATE TRIGGER trigger_create_chat_room_on_tour_insert
  AFTER INSERT ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.create_chat_room_for_tour();

-- ---------------------------------------------------------------------------
-- 투어 상태 변경 시 채팅방 활성/비활성 — scheduled 포함
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_chat_room_status()
RETURNS TRIGGER AS $$
DECLARE
  old_active BOOLEAN;
  new_active BOOLEAN;
BEGIN
  old_active := (
    OLD.tour_status IS NOT NULL
    AND lower(trim(OLD.tour_status)) IN ('recruiting', 'confirmed', 'scheduled')
  );
  new_active := (
    NEW.tour_status IS NOT NULL
    AND lower(trim(NEW.tour_status)) IN ('recruiting', 'confirmed', 'scheduled')
  );

  IF new_active THEN
    UPDATE public.chat_rooms
    SET is_active = true
    WHERE tour_id = NEW.id;
  ELSIF old_active AND NOT new_active THEN
    UPDATE public.chat_rooms
    SET is_active = false
    WHERE tour_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
