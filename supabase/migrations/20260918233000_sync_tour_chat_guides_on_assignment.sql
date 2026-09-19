-- 투어 가이드/어시스턴트 배정이 바뀌면 해당 투어 채팅방 가이드 멤버를 맞춘다.
-- 수동 초대 멤버(membership_source = invited)는 배정 동기화에서 제거하지 않는다.

ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS membership_source text;

UPDATE public.chat_participants
SET membership_source = 'assignment'
WHERE membership_source IS NULL;

ALTER TABLE public.chat_participants
  ALTER COLUMN membership_source SET DEFAULT 'assignment';

ALTER TABLE public.chat_participants
  ALTER COLUMN membership_source SET NOT NULL;

ALTER TABLE public.chat_participants
  DROP CONSTRAINT IF EXISTS chat_participants_membership_source_check;

ALTER TABLE public.chat_participants
  ADD CONSTRAINT chat_participants_membership_source_check
  CHECK (membership_source IN ('assignment', 'invited'));

COMMENT ON COLUMN public.chat_participants.membership_source IS
  'assignment: 투어 배정으로 자동 추가. invited: 수동 초대. 배정 동기화는 assignment만 제거한다.';

-- 가이드 참여자 중복 정리 (활성 행 우선)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY room_id, lower(participant_id)
      ORDER BY coalesce(is_active, false) DESC, joined_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.chat_participants
  WHERE participant_type = 'guide'
)
DELETE FROM public.chat_participants
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS chat_participants_room_guide_email_uidx
  ON public.chat_participants (room_id, lower(participant_id))
  WHERE participant_type = 'guide';

CREATE OR REPLACE FUNCTION public.normalize_tour_staff_emails(raw text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT lower(trim(part))
      FROM unnest(
        string_to_array(
          regexp_replace(coalesce(raw, ''), '[\[\]"]', '', 'g'),
          ','
        )
      ) AS part
      WHERE trim(part) <> ''
    ),
    '{}'::text[]
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_tour_chat_guide_participants(p_tour_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_assigned text[];
  v_email text;
  v_team_email text;
  v_name text;
BEGIN
  IF p_tour_id IS NULL OR btrim(p_tour_id) = '' THEN
    RETURN;
  END IF;

  SELECT cr.id
  INTO v_room_id
  FROM public.chat_rooms cr
  WHERE cr.tour_id = p_tour_id
  ORDER BY cr.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_room_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    ARRAY(
      SELECT DISTINCT e
      FROM unnest(
        public.normalize_tour_staff_emails(t.tour_guide_id)
        || public.normalize_tour_staff_emails(t.assistant_id)
      ) AS e
    )
  INTO v_assigned
  FROM public.tours t
  WHERE t.id = p_tour_id;

  IF v_assigned IS NULL THEN
    v_assigned := '{}'::text[];
  END IF;

  UPDATE public.chat_participants cp
  SET is_active = false
  WHERE cp.room_id = v_room_id
    AND cp.participant_type = 'guide'
    AND coalesce(cp.membership_source, 'assignment') = 'assignment'
    AND lower(cp.participant_id) <> ALL (v_assigned)
    AND coalesce(cp.is_active, true);

  FOREACH v_email IN ARRAY v_assigned
  LOOP
    SELECT tm.email, coalesce(nullif(trim(tm.name_ko), ''), nullif(trim(tm.name_en), ''), tm.email)
    INTO v_team_email, v_name
    FROM public.team tm
    WHERE lower(tm.email) = v_email
    LIMIT 1;

    IF v_team_email IS NULL THEN
      v_team_email := v_email;
      v_name := v_email;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.chat_participants cp
      WHERE cp.room_id = v_room_id
        AND cp.participant_type = 'guide'
        AND lower(cp.participant_id) = v_email
    ) THEN
      UPDATE public.chat_participants
      SET
        is_active = true,
        participant_id = v_team_email,
        participant_name = v_name,
        membership_source = CASE
          WHEN membership_source = 'invited' THEN 'invited'
          ELSE 'assignment'
        END
      WHERE room_id = v_room_id
        AND participant_type = 'guide'
        AND lower(participant_id) = v_email;
    ELSE
      INSERT INTO public.chat_participants (
        room_id,
        participant_type,
        participant_id,
        participant_name,
        is_active,
        membership_source
      ) VALUES (
        v_room_id,
        'guide',
        v_team_email,
        v_name,
        true,
        'assignment'
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_tour_chat_guide_participants_from_tour()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.tour_guide_id IS NOT DISTINCT FROM OLD.tour_guide_id
     AND NEW.assistant_id IS NOT DISTINCT FROM OLD.assistant_id THEN
    RETURN NEW;
  END IF;

  PERFORM public.sync_tour_chat_guide_participants(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_tour_chat_guides_on_assignment ON public.tours;

CREATE TRIGGER trigger_sync_tour_chat_guides_on_assignment
  AFTER UPDATE OF tour_guide_id, assistant_id ON public.tours
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_tour_chat_guide_participants_from_tour();

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
    PERFORM public.sync_tour_chat_guide_participants(NEW.id);
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

  PERFORM public.sync_tour_chat_guide_participants(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.sync_tour_chat_guide_participants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_tour_chat_guide_participants(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_tour_chat_guide_participants(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_tour_staff_emails(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_tour_staff_emails(text) TO authenticated;

-- 최근 90일 + 미래 투어의 잘못된 가이드 멤버를 한 번 정리
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT cr.tour_id
    FROM public.chat_rooms cr
    JOIN public.tours t ON t.id = cr.tour_id
    WHERE t.tour_date >= (CURRENT_DATE - 90)
  LOOP
    PERFORM public.sync_tour_chat_guide_participants(r.tour_id);
  END LOOP;
END $$;
