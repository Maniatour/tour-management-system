-- 채팅방 생성 시 기본 공지사항 자동 추가
-- Migration: 20251225000001_add_default_chat_announcements

-- 채팅방 생성 함수 수정 - 기본 공지사항 자동 추가
CREATE OR REPLACE FUNCTION create_chat_room_for_tour()
RETURNS TRIGGER AS $$
DECLARE
    product_name TEXT;
    room_code TEXT;
    existing_room_count INTEGER;
    new_room_id UUID;
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
    ) RETURNING id INTO new_room_id;
    
    -- 기본 공지사항 추가 (한글)
    INSERT INTO chat_room_announcements (
        room_id,
        title,
        content,
        language,
        is_active,
        created_by
    ) VALUES (
        new_room_id,
        '채팅방 이용 안내',
        E'안녕하세요. 투어 채팅방에 오신 것을 환영합니다.\n\n다음 사항을 참고하여 쾌적한 채팅 환경을 만들어 주시기 바랍니다:\n\n• 본 채팅방은 투어에 동행하는 모든 인원이 참여하는 공간입니다. 불필요한 잡담이나 욕설, 비방 등의 부적절한 언행을 자제하여 서로를 존중하는 예의 있는 대화를 부탁드립니다.\n\n• 본 채팅방은 투어일로부터 7일 후 자동으로 삭제됩니다. 중요한 정보나 사진은 반드시 그 전에 다운로드하여 보관하시기 바랍니다.\n\n• 채팅방이 삭제되면 업로드된 투어 사진도 함께 삭제됩니다. 원하시는 사진이 있으시면 반드시 미리 다운로드하시기 바랍니다.\n\n• 동행 모집 투어의 특성상 여러 참가자의 사진이 함께 업로드될 수 있습니다. 본인의 사진을 다운로드한 후, 사진 표시를 중단해 달라는 요청이 필요하시면 가이드에게 직접 연락 주시기 바랍니다.\n\n• 투어 관련 문의사항이나 긴급한 상황이 발생할 경우, 채팅방을 통한 연락보다는 가이드에게 직접 전화 연락을 권장드립니다.\n\n• 픽업 시간 및 장소 변경, 일정 변경 등 중요한 안내사항은 가이드가 공지사항으로 별도 안내해 드립니다. 공지사항을 수시로 확인해 주시기 바랍니다.\n\n• 개인정보 보호를 위해 채팅방 내에서 개인 연락처나 민감한 정보를 공유하지 않도록 주의해 주시기 바랍니다.\n\n즐거운 투어 되시기 바랍니다.',
        'ko',
        true,
        'system'
    );
    
    -- 기본 공지사항 추가 (영문)
    INSERT INTO chat_room_announcements (
        room_id,
        title,
        content,
        language,
        is_active,
        created_by
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

-- 기존 채팅방에 공지사항이 없으면 추가하는 함수
CREATE OR REPLACE FUNCTION add_default_announcements_to_existing_rooms()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    announcement_count INTEGER;
BEGIN
    -- 모든 활성화된 채팅방 확인
    FOR room_record IN 
        SELECT id, tour_id 
        FROM chat_rooms 
        WHERE is_active = true
    LOOP
        -- 해당 채팅방에 공지사항이 있는지 확인
        SELECT COUNT(*) INTO announcement_count
        FROM chat_room_announcements
        WHERE room_id = room_record.id
        AND title IN ('채팅방 이용 안내', 'Chat Room Guidelines');
        
        -- 공지사항이 없으면 추가
        IF announcement_count = 0 THEN
            -- 한글 공지사항 추가
            INSERT INTO chat_room_announcements (
                room_id,
                title,
                content,
                language,
                is_active,
                created_by
            ) VALUES (
                room_record.id,
                '채팅방 이용 안내',
                E'안녕하세요. 투어 채팅방에 오신 것을 환영합니다.\n\n다음 사항을 참고하여 쾌적한 채팅 환경을 만들어 주시기 바랍니다:\n\n• 본 채팅방은 투어에 동행하는 모든 인원이 참여하는 공간입니다. 불필요한 잡담이나 욕설, 비방 등의 부적절한 언행을 자제하여 서로를 존중하는 예의 있는 대화를 부탁드립니다.\n\n• 본 채팅방은 투어일로부터 7일 후 자동으로 삭제됩니다. 중요한 정보나 사진은 반드시 그 전에 다운로드하여 보관하시기 바랍니다.\n\n• 채팅방이 삭제되면 업로드된 투어 사진도 함께 삭제됩니다. 원하시는 사진이 있으시면 반드시 미리 다운로드하시기 바랍니다.\n\n• 동행 모집 투어의 특성상 여러 참가자의 사진이 함께 업로드될 수 있습니다. 본인의 사진을 다운로드한 후, 사진 표시를 중단해 달라는 요청이 필요하시면 가이드에게 직접 연락 주시기 바랍니다.\n\n• 투어 관련 문의사항이나 긴급한 상황이 발생할 경우, 채팅방을 통한 연락보다는 가이드에게 직접 전화 연락을 권장드립니다.\n\n• 픽업 시간 및 장소 변경, 일정 변경 등 중요한 안내사항은 가이드가 공지사항으로 별도 안내해 드립니다. 공지사항을 수시로 확인해 주시기 바랍니다.\n\n• 개인정보 보호를 위해 채팅방 내에서 개인 연락처나 민감한 정보를 공유하지 않도록 주의해 주시기 바랍니다.\n\n즐거운 투어 되시기 바랍니다.',
                'ko',
                true,
                'system'
            );
            
            -- 영문 공지사항 추가
            INSERT INTO chat_room_announcements (
                room_id,
                title,
                content,
                language,
                is_active,
                created_by
            ) VALUES (
                room_record.id,
                'Chat Room Guidelines',
                E'Welcome to the tour chat room.\n\nPlease observe the following guidelines to maintain a pleasant chat environment:\n\n• This chat room is a shared space for all tour participants. Please refrain from unnecessary small talk, profanity, or inappropriate behavior. We ask that you maintain respectful and courteous communication.\n\n• This chat room will be automatically deleted 7 days after the tour date. Please ensure to download any important information or photos before that time.\n\n• When the chat room is deleted, all uploaded tour photos will also be deleted. If you wish to keep any photos, please download them in advance.\n\n• Due to the nature of group tours, photos of multiple participants may be uploaded together. If you download your photos and wish to request that they be removed from display, please contact the guide directly.\n\n• For tour-related inquiries or urgent situations, we recommend contacting the guide directly by phone rather than through the chat room.\n\n• Important announcements such as pickup time and location changes, or schedule modifications, will be posted separately by the guide. Please check announcements regularly.\n\n• For privacy protection, please be cautious not to share personal contact information or sensitive data within the chat room.\n\nWe hope you have a wonderful tour experience.',
                'en',
                true,
                'system'
            );
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 기존 채팅방에 공지사항 추가 실행
SELECT add_default_announcements_to_existing_rooms();

