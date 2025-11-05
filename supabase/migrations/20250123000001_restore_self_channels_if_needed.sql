-- Self 채널 복구 마이그레이션 (필요시 사용)
-- 기존 Self 채널들이 모두 삭제된 경우 복구하는 스크립트
-- Migration: 20250123000001_restore_self_channels_if_needed

-- 주의: 이 마이그레이션은 기존 Self 채널들이 삭제된 경우를 복구하기 위한 것입니다.
-- 실행 전에 현재 상태를 확인하세요:
-- SELECT id, name, category, type, status FROM channels WHERE category = 'Own' OR category = 'Self';

-- 1. customers와 reservations 테이블에서 사용된 서브 채널 목록 추출
-- 여러 소스에서 정보를 수집 (sub_channel, channel_rn, channel_id 직접 참조 등)
DO $$
DECLARE
    sub_channel_names TEXT[];
    channel_record RECORD;
    self_channel_exists BOOLEAN;
    channel_id_text TEXT;
    channel_name_from_id TEXT;
BEGIN
    -- 방법 1: sub_channel 필드에서 추출 (이미 마이그레이션된 경우)
    SELECT ARRAY_AGG(DISTINCT sub_channel) INTO sub_channel_names
    FROM (
        SELECT sub_channel FROM customers WHERE sub_channel IS NOT NULL AND sub_channel != ''
        UNION
        SELECT sub_channel FROM reservations WHERE sub_channel IS NOT NULL AND sub_channel != ''
    ) AS sub_channels;
    
    -- 방법 2: channel_rn 필드에서 추출 (reservations에만 있음)
    -- sub_channel_names가 비어있을 때만 실행
    IF array_length(sub_channel_names, 1) IS NULL OR array_length(sub_channel_names, 1) = 0 THEN
        SELECT ARRAY_AGG(DISTINCT channel_rn) INTO sub_channel_names
        FROM reservations 
        WHERE channel_rn IS NOT NULL 
          AND channel_rn != ''
          AND channel_id = 'SELF';
    END IF;
    
    -- 방법 3: customers와 reservations의 channel_id에서 직접 참조 (마이그레이션이 아직 실행되지 않은 경우)
    -- SELF가 아닌 channel_id를 가진 레코드들에서 채널 이름 찾기
    IF array_length(sub_channel_names, 1) IS NULL OR array_length(sub_channel_names, 1) = 0 THEN
        SELECT ARRAY_AGG(DISTINCT ch.name) INTO sub_channel_names
        FROM (
            SELECT DISTINCT channel_id FROM customers WHERE channel_id IS NOT NULL AND channel_id != 'SELF'
            UNION
            SELECT DISTINCT channel_id FROM reservations WHERE channel_id IS NOT NULL AND channel_id != 'SELF'
        ) AS old_channel_ids
        JOIN channels ch ON ch.id = old_channel_ids.channel_id
        WHERE ch.category = 'Own' OR ch.type ILIKE '%self%';
    END IF;
    
    -- 'SELF' 채널이 존재하는지 확인
    SELECT EXISTS(SELECT 1 FROM channels WHERE id = 'SELF') INTO self_channel_exists;
    
    -- 'SELF' 채널이 없으면 생성
    IF NOT self_channel_exists THEN
        INSERT INTO channels (
            id, 
            name, 
            type, 
            category, 
            sub_channels,
            status,
            description,
            commission,
            base_price,
            markup
        ) VALUES (
            'SELF',
            'Self',
            'Self',
            'Self',
            COALESCE(sub_channel_names, ARRAY[]::TEXT[]),
            'active',
            '자체 판매 채널 통합 (카카오톡, 블로그 등 포함)',
            0.00,
            0.00,
            0.00
        );
    ELSE
        -- 'SELF' 채널이 있으면 sub_channels 업데이트
        UPDATE channels
        SET sub_channels = COALESCE(sub_channel_names, ARRAY[]::TEXT[])
        WHERE id = 'SELF';
    END IF;
    
    -- 2. 삭제된 Self 채널들을 복구 (sub_channel 이름을 기반으로)
    -- customers와 reservations의 sub_channel 정보를 기반으로 원래 채널 복구
    IF array_length(sub_channel_names, 1) > 0 THEN
        RAISE NOTICE 'Found % sub channels to restore', array_length(sub_channel_names, 1);
        
        FOR channel_record IN 
            SELECT DISTINCT unnest(sub_channel_names) AS sub_channel_name
        LOOP
            -- 해당 이름의 채널이 없으면 복구
            -- ID는 소문자로 변환하고 공백/특수문자를 언더스코어로 변경
            channel_id_text := LOWER(REPLACE(REPLACE(REPLACE(channel_record.sub_channel_name, ' ', '_'), '-', '_'), '.', '_'));
            
            -- 이름이 비어있으면 스킵
            IF channel_record.sub_channel_name IS NULL OR TRIM(channel_record.sub_channel_name) = '' THEN
                CONTINUE;
            END IF;
            
            IF NOT EXISTS (
                SELECT 1 FROM channels 
                WHERE (name = channel_record.sub_channel_name OR id = channel_id_text OR id = channel_record.sub_channel_name)
                  AND id != 'SELF'
            ) THEN
                RAISE NOTICE 'Restoring channel: % (ID: %)', channel_record.sub_channel_name, channel_id_text;
                
                INSERT INTO channels (
                    id,
                    name,
                    type,
                    category,
                    status,
                    description,
                    commission,
                    base_price,
                    markup
                ) VALUES (
                    channel_id_text,
                    channel_record.sub_channel_name,
                    'Self',
                    'Own',  -- 복구 시 원래 카테고리로 설정
                    'inactive',  -- 비활성 상태로 복구 (SELF로 통합되었으므로)
                    '복구된 채널 (SELF로 통합됨)',
                    0.00,
                    0.00,
                    0.00
                )
                ON CONFLICT (id) DO UPDATE
                SET status = 'inactive',
                    description = COALESCE(channels.description, '') || ' [복구됨: SELF로 통합]';
            ELSE
                RAISE NOTICE 'Channel already exists: %', channel_record.sub_channel_name;
            END IF;
        END LOOP;
    ELSE
        RAISE NOTICE 'No sub channels found to restore. Checking audit logs...';
        
        -- 방법 4: audit_logs에서 삭제된 채널 정보 찾기
        SELECT ARRAY_AGG(DISTINCT old_values->>'name') INTO sub_channel_names
        FROM audit_logs
        WHERE table_name = 'channels'
          AND action = 'DELETE'
          AND old_values IS NOT NULL
          AND (old_values->>'category' = 'Own' OR old_values->>'type' ILIKE '%self%')
          AND old_values->>'name' IS NOT NULL;
        
        IF array_length(sub_channel_names, 1) > 0 THEN
            RAISE NOTICE 'Found % channels from audit logs', array_length(sub_channel_names, 1);
            
            FOR channel_record IN 
                SELECT DISTINCT unnest(sub_channel_names) AS sub_channel_name
            LOOP
                channel_id_text := LOWER(REPLACE(REPLACE(REPLACE(channel_record.sub_channel_name, ' ', '_'), '-', '_'), '.', '_'));
                
                IF NOT EXISTS (
                    SELECT 1 FROM channels 
                    WHERE (name = channel_record.sub_channel_name OR id = channel_id_text OR id = channel_record.sub_channel_name)
                      AND id != 'SELF'
                ) THEN
                    INSERT INTO channels (
                        id,
                        name,
                        type,
                        category,
                        status,
                        description,
                        commission,
                        base_price,
                        markup
                    ) VALUES (
                        channel_id_text,
                        channel_record.sub_channel_name,
                        'Self',
                        'Own',
                        'inactive',
                        '복구된 채널 (audit_logs에서 복구, SELF로 통합됨)',
                        0.00,
                        0.00,
                        0.00
                    )
                    ON CONFLICT (id) DO UPDATE
                    SET status = 'inactive',
                        description = COALESCE(channels.description, '') || ' [audit_logs에서 복구됨]';
                END IF;
            END LOOP;
        END IF;
    END IF;
END $$;

-- 3. 복구된 채널들의 상태 확인
SELECT 
    id,
    name,
    category,
    type,
    status,
    sub_channels,
    description
FROM channels
WHERE category = 'Own' OR category = 'Self'
ORDER BY status, name;

