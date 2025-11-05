-- Self 채널 복구 진단 및 수동 복구 스크립트
-- Migration: 20250123000002_diagnose_and_manual_restore_channels

-- ============================================
-- 1. 현재 상태 진단
-- ============================================

-- 1-1. 현재 channels 테이블 상태 확인
SELECT 
    '현재 channels 테이블 상태' as section,
    id,
    name,
    category,
    type,
    status,
    sub_channels
FROM channels
ORDER BY category, name;

-- 1-2. customers 테이블의 channel_id 상태 확인
SELECT 
    'customers 테이블 channel_id 상태' as section,
    channel_id,
    sub_channel,
    COUNT(*) as count
FROM customers
GROUP BY channel_id, sub_channel
ORDER BY count DESC;

-- 1-3. reservations 테이블의 channel_id 상태 확인
SELECT 
    'reservations 테이블 channel_id 상태' as section,
    channel_id,
    sub_channel,
    channel_rn,
    COUNT(*) as count
FROM reservations
GROUP BY channel_id, sub_channel, channel_rn
ORDER BY count DESC;

-- 1-4. audit_logs에서 삭제된 Self 채널 확인
SELECT 
    'audit_logs에서 삭제된 채널' as section,
    old_values->>'id' as channel_id,
    old_values->>'name' as channel_name,
    old_values->>'category' as category,
    old_values->>'type' as type,
    created_at as deleted_at
FROM audit_logs
WHERE table_name = 'channels'
  AND action = 'DELETE'
  AND old_values IS NOT NULL
  AND (old_values->>'category' = 'Own' OR old_values->>'type' ILIKE '%self%' OR old_values->>'name' ILIKE '%kakaotalk%' OR old_values->>'name' ILIKE '%blog%')
ORDER BY created_at DESC;

-- ============================================
-- 2. audit_logs에서 삭제된 채널 자동 복구
-- ============================================

DO $$
DECLARE
    deleted_channel RECORD;
    sub_channel_names TEXT[];
    self_channel_exists BOOLEAN;
BEGIN
    -- audit_logs에서 삭제된 Self 채널들 복구
    FOR deleted_channel IN 
        SELECT DISTINCT
            old_values->>'id' as channel_id,
            old_values->>'name' as channel_name,
            old_values->>'category' as category,
            old_values->>'type' as type
        FROM audit_logs
        WHERE table_name = 'channels'
          AND action = 'DELETE'
          AND old_values IS NOT NULL
          AND (
              old_values->>'category' = 'Own' 
              OR old_values->>'type' ILIKE '%self%'
              OR old_values->>'name' ILIKE '%kakaotalk%'
              OR old_values->>'name' ILIKE '%blog%'
              OR old_values->>'name' ILIKE '%instagram%'
              OR old_values->>'name' ILIKE '%facebook%'
              OR old_values->>'name' ILIKE '%naver%'
              OR old_values->>'name' ILIKE '%phone%'
              OR old_values->>'name' ILIKE '%homepage%'
          )
    LOOP
        -- 채널이 없으면 복구 (원래 ID와 이름으로)
        IF deleted_channel.channel_id IS NOT NULL AND deleted_channel.channel_name IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1 FROM channels WHERE id = deleted_channel.channel_id
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
                    deleted_channel.channel_id,
                    deleted_channel.channel_name,
                    COALESCE(deleted_channel.type, 'Self'),
                    COALESCE(deleted_channel.category, 'Own'),
                    'inactive',  -- 비활성 상태로 복구 (SELF로 통합되었으므로)
                    '복구된 채널 (audit_logs에서 복구, SELF로 통합됨)',
                    0.00,
                    0.00,
                    0.00
                )
                ON CONFLICT (id) DO UPDATE
                SET status = 'inactive',
                    description = COALESCE(channels.description, '') || ' [복구됨]';
                
                -- sub_channel_names 배열에 이름 추가
                sub_channel_names := array_append(COALESCE(sub_channel_names, ARRAY[]::TEXT[]), deleted_channel.channel_name);
            END IF;
        END IF;
    END LOOP;
    
    -- SELF 채널 생성 또는 업데이트
    SELECT EXISTS(SELECT 1 FROM channels WHERE id = 'SELF') INTO self_channel_exists;
    
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
        -- 기존 SELF 채널의 sub_channels 업데이트 (중복 제거)
        UPDATE channels
        SET sub_channels = (
            SELECT ARRAY_AGG(DISTINCT elem ORDER BY elem)
            FROM unnest(COALESCE(channels.sub_channels, ARRAY[]::TEXT[]) || COALESCE(sub_channel_names, ARRAY[]::TEXT[])) AS elem
            WHERE elem IS NOT NULL
        )
        WHERE id = 'SELF';
    END IF;
    
    RAISE NOTICE '복구 완료: % 개의 채널 처리', array_length(sub_channel_names, 1);
END $$;

-- ============================================
-- 3. 복구 후 확인
-- ============================================

SELECT 
    '복구 후 channels 상태' as section,
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

-- ============================================
-- 4. 사용 안내
-- ============================================
-- 
-- 위 스크립트를 실행하면:
-- 1. 현재 상태를 진단합니다 (channels, customers, reservations, audit_logs)
-- 2. audit_logs에서 삭제된 Self 채널들을 자동으로 복구합니다
--    - 원래 채널 ID와 이름으로 복구
--    - 'inactive' 상태로 설정 (SELF로 통합되었으므로)
-- 3. SELF 채널을 생성하거나 업데이트합니다
--    - 복구된 채널 이름들을 sub_channels 배열에 추가
-- 4. 복구 후 상태를 확인합니다
--
-- 복구될 채널 목록 (audit_logs 기준):
-- - Kakaotalk, Kakaotalk 1, Kakaotalk 2, Open Kakaotalk, Open Kakaotalk 2
-- - Blog, Phone Call, Naver, Naver talktalk
-- - Reference, Modoo, Facebook, Daum Cafe, Instagram
-- - LTE Tour, Navajo Kim, Chowon Tour, Exciting Tour, Others, Homepage

