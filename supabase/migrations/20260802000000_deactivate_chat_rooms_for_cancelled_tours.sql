-- 취소·삭제(Deleted, Canceled - … 등) 투어의 채팅방을 자동 비활성화
-- src/utils/tourStatusUtils.ts 의 isTourCancelled / isTourDeleted 와 동일한 판정

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_tour_deleted_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_status IS NULL OR btrim(p_status) = '' THEN false
    ELSE (
      lower(btrim(p_status)) = 'deleted'
      OR lower(p_status) LIKE '%requested for delete%'
      OR p_status LIKE '%삭제%'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_tour_cancelled_only_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN public.is_tour_deleted_status(p_status) THEN false
    WHEN p_status IS NULL OR btrim(p_status) = '' THEN false
    ELSE (
      lower(btrim(p_status)) IN ('cancelled', 'canceled', 'cancel')
      OR lower(p_status) LIKE '%cancel%'
      OR p_status LIKE '%취소%'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_tour_cancelled_or_deleted_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.is_tour_deleted_status(p_status)
      OR public.is_tour_cancelled_only_status(p_status);
$$;

COMMENT ON FUNCTION public.is_tour_cancelled_or_deleted_status(text) IS
  '투어 취소·삭제 상태 (Deleted, Canceled - …, 삭제/취소 포함)';

CREATE OR REPLACE FUNCTION public.is_tour_chat_room_eligible_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN public.is_tour_cancelled_or_deleted_status(p_status) THEN false
    WHEN p_status IS NULL OR btrim(p_status) = '' THEN false
    ELSE lower(btrim(p_status)) IN ('recruiting', 'confirmed', 'confirm', 'scheduled')
  END;
$$;

COMMENT ON FUNCTION public.is_tour_chat_room_eligible_status(text) IS
  '채팅방을 활성화할 수 있는 진행 투어 상태';

-- ---------------------------------------------------------------------------
-- 투어 상태 변경 시 채팅방 동기화 (취소·삭제는 무조건 비활성화)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_chat_room_status()
RETURNS TRIGGER AS $$
BEGIN
  IF public.is_tour_cancelled_or_deleted_status(NEW.tour_status) THEN
    UPDATE public.chat_rooms
    SET is_active = false,
        updated_at = NOW()
    WHERE tour_id = NEW.id
      AND is_active IS DISTINCT FROM false;
  ELSIF public.is_tour_chat_room_eligible_status(NEW.tour_status) THEN
    UPDATE public.chat_rooms
    SET is_active = true,
        updated_at = NOW()
    WHERE tour_id = NEW.id
      AND is_active IS DISTINCT FROM true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_room_on_tour_status_change ON public.tours;

CREATE TRIGGER trigger_update_chat_room_on_tour_status_change
  AFTER UPDATE OF tour_status ON public.tours
  FOR EACH ROW
  WHEN (OLD.tour_status IS DISTINCT FROM NEW.tour_status)
  EXECUTE FUNCTION public.update_chat_room_status();

-- ---------------------------------------------------------------------------
-- 신규 투어 채팅방 생성 시 취소·삭제 투어는 비활성으로 생성
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_chat_room_for_tour()
RETURNS TRIGGER AS $$
DECLARE
  product_name TEXT;
  room_code TEXT;
  existing_room_count INTEGER;
  new_room_id UUID;
  room_active BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO existing_room_count
  FROM public.chat_rooms
  WHERE tour_id = NEW.id;

  IF existing_room_count > 0 THEN
    RETURN NEW;
  END IF;

  room_active := public.is_tour_chat_room_eligible_status(NEW.tour_status);

  SELECT name_ko INTO product_name
  FROM public.products
  WHERE id = NEW.product_id;

  IF product_name IS NULL THEN
    product_name := '투어';
  END IF;

  room_code := 'TOUR_' || NEW.id || '_' || substr(md5(random()::text), 1, 8);

  INSERT INTO public.chat_rooms (
    tour_id,
    room_name,
    room_code,
    description,
    is_active,
    created_by
  ) VALUES (
    NEW.id,
    product_name || ' 채팅방',
    room_code,
    product_name || ' 투어 관련 문의사항을 남겨주세요.',
    room_active,
    'system'
  ) RETURNING id INTO new_room_id;

  INSERT INTO public.chat_room_announcements (
    room_id, title, content, language, is_active, created_by
  ) VALUES (
    new_room_id,
    '채팅방 이용 안내',
    E'안녕하세요. 투어 채팅방에 오신 것을 환영합니다.\n\n다음 사항을 참고하여 쾌적한 채팅 환경을 만들어 주시기 바랍니다:\n\n• 본 채팅방은 투어에 동행하는 모든 인원이 참여하는 공간입니다. 불필요한 잡담이나 욕설, 비방 등의 부적절한 언행을 자제하여 서로를 존중하는 예의 있는 대화를 부탁드립니다.\n\n• 본 채팅방은 투어일로부터 7일 후 자동으로 삭제됩니다. 중요한 정보나 사진은 반드시 그 전에 다운로드하여 보관하시기 바랍니다.\n\n• 채팅방이 삭제되면 업로드된 투어 사진도 함께 삭제됩니다. 원하시는 사진이 있으시면 반드시 미리 다운로드하시기 바랍니다.\n\n• 동행 모집 투어의 특성상 여러 참가자의 사진이 함께 업로드될 수 있습니다. 본인의 사진을 다운로드한 후, 사진 표시를 중단해 달라는 요청이 필요하시면 가이드에게 직접 연락 주시기 바랍니다.\n\n• 투어 관련 문의사항이나 긴급한 상황이 발생할 경우, 채팅방을 통한 연락보다는 가이드에게 직접 전화 연락을 권장드립니다.\n\n• 픽업 시간 및 장소 변경, 일정 변경 등 중요한 안내사항은 가이드가 공지사항으로 별도 안내해 드립니다. 공지사항을 수시로 확인해 주시기 바랍니다.\n\n• 개인정보 보호를 위해 채팅방 내에서 개인 연락처나 민감한 정보를 공유하지 않도록 주의해 주시기 바랍니다.\n\n즐거운 투어 되시기 바랍니다.',
    'ko',
    true,
    'system'
  );

  INSERT INTO public.chat_room_announcements (
    room_id, title, content, language, is_active, created_by
  ) VALUES (
    new_room_id,
    'Chat Room Guidelines',
    E'Welcome to the tour chat room.\n\nPlease observe the following guidelines to maintain a pleasant chat environment:\n\n• This chat room is a shared space for all tour participants. Please refrain from unnecessary small talk, profanity, or inappropriate behavior. We ask that you maintain respectful and courteous communication.\n\n• This chat room will be automatically deleted 7 days after the tour date. Please ensure to download any important information or photos before that time.\n\n• When the chat room is deleted, all uploaded tour photos will also be deleted. If you wish to keep any photos, please download them in advance.\n\n• Due to the nature of group tours, photos of multiple participants may be uploaded together. If you download your photos and wish to request that they be removed from display, please contact the guide directly.\n\n• For tour-related inquiries or urgent situations, we recommend contacting the guide directly by phone rather than through the chat room.\n\n• Important announcements such as pickup time and location changes, or schedule modifications, will be posted separately by the guide. Please check announcements regularly.\n\n• For privacy protection, please be cautious not to share personal contact information or sensitive data within the chat room.\n\nWe hope you have a wonderful tour experience.',
    'en',
    true,
    'system'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 기존 데이터 백필: 취소·삭제 투어의 활성 채팅방 비활성화
-- ---------------------------------------------------------------------------
UPDATE public.chat_rooms cr
SET
  is_active = false,
  updated_at = NOW()
FROM public.tours t
WHERE cr.tour_id = t.id
  AND cr.is_active = true
  AND public.is_tour_cancelled_or_deleted_status(t.tour_status);

COMMIT;
