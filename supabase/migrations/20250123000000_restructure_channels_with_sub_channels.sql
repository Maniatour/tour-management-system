-- Channels 테이블 구조 재구성
-- Self 카테고리 채널들을 하나로 통합하고 sub_channels 컬럼 추가
-- Migration: 20250123000000_restructure_channels_with_sub_channels

-- 1. sub_channels 컬럼 추가 (TEXT 배열로 서브 채널 목록 저장)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS sub_channels TEXT[] DEFAULT ARRAY[]::TEXT[];

-- sub_channels 컬럼에 대한 코멘트 추가
COMMENT ON COLUMN channels.sub_channels IS '서브 채널 목록 (Self 카테고리 채널의 경우만 사용). 예: {kakaotalk, blog, instagram}';

-- sub_channels 배열 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_channels_sub_channels ON channels USING GIN (sub_channels);

-- 1-2. customers 테이블에 sub_channel 컬럼 추가 (원래 서브 채널 정보 보존용)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sub_channel TEXT;
COMMENT ON COLUMN customers.sub_channel IS '원래 Self 채널의 서브 채널 이름 (예: kakaotalk, blog). channel_id가 SELF일 때 사용';

-- 1-3. reservations 테이블에 sub_channel 컬럼 추가 (원래 서브 채널 정보 보존용)
-- channel_rn 필드가 이미 있지만, 명확성을 위해 sub_channel도 추가
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sub_channel TEXT;
COMMENT ON COLUMN reservations.sub_channel IS '원래 Self 채널의 서브 채널 이름 (예: kakaotalk, blog). channel_id가 SELF일 때 사용';

-- 인덱스 생성 (서브 채널 검색용)
CREATE INDEX IF NOT EXISTS idx_customers_sub_channel ON customers(sub_channel);
CREATE INDEX IF NOT EXISTS idx_reservations_sub_channel ON reservations(sub_channel);

-- 1-1. category 제약조건 업데이트 (Self 추가) - Self 채널 생성 전에 먼저 실행
ALTER TABLE channels DROP CONSTRAINT IF EXISTS chk_channel_category;
ALTER TABLE channels ADD CONSTRAINT chk_channel_category 
  CHECK (category IN ('Own', 'Self', 'OTA', 'Partner'));

-- category 컬럼 코멘트 업데이트
COMMENT ON COLUMN channels.category IS 'Channel category: Own (자체), Self (자체 판매 통합), OTA (Online Travel Agency), Partner (제휴)';

-- 2. 기존 Self 채널들 확인 및 통합 준비
-- 주의: 마이그레이션 실행 전에 현재 Self 채널 목록을 확인하세요:
-- SELECT id, name, category, type FROM channels WHERE category = 'Own' OR type ILIKE '%self%';

-- Self 채널 ID 목록을 명시적으로 지정 (실제 데이터에 맞게 수정 필요)
-- 예시: kakaotalk, blog, instagram 등 자체 판매 채널들의 ID
DO $$
DECLARE
    self_channel_id TEXT := 'SELF';
    self_channel_name TEXT := 'Self';
    existing_self_count INTEGER;
    sub_channel_list TEXT[];
    self_channel_ids TEXT[] := ARRAY[]::TEXT[]; -- 여기에 Self 채널 ID 목록을 지정하세요
    -- 예시: self_channel_ids := ARRAY['kakaotalk', 'blog', 'instagram', 'facebook', 'naver', ...];
    channel_record RECORD;
BEGIN
    -- 방법 1: 명시적으로 Self 채널 ID 목록을 지정한 경우
    -- self_channel_ids가 비어있지 않으면 지정된 채널들을 사용
    
    -- 방법 2: 자동으로 Self 채널 찾기 (category = 'Own' 또는 type에 'self' 포함)
    IF array_length(self_channel_ids, 1) IS NULL THEN
        SELECT ARRAY_AGG(id) INTO self_channel_ids
        FROM channels
        WHERE category = 'Own'
           OR (type ILIKE '%self%' AND category != 'OTA' AND category != 'Partner')
           OR (name ILIKE '%kakaotalk%' AND category != 'OTA' AND category != 'Partner')
           OR (name ILIKE '%blog%' AND category != 'OTA' AND category != 'Partner')
           OR (name ILIKE '%instagram%' AND category != 'OTA' AND category != 'Partner')
           OR (name ILIKE '%facebook%' AND category != 'OTA' AND category != 'Partner');
    END IF;
    
    -- 서브 채널 이름 목록 생성 (Self 채널들의 name)
    SELECT ARRAY_AGG(name ORDER BY name) INTO sub_channel_list
    FROM channels
    WHERE id = ANY(self_channel_ids);
    
    -- 기존 Self 통합 채널이 있는지 확인
    SELECT COUNT(*) INTO existing_self_count 
    FROM channels 
    WHERE id = self_channel_id;
    
    -- 기존 Self 채널이 없으면 생성
    IF existing_self_count = 0 THEN
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
            self_channel_id,
            self_channel_name,
            'Self',
            'Self',
            COALESCE(sub_channel_list, ARRAY[]::TEXT[]),
            'active',
            '자체 판매 채널 통합 (카카오톡, 블로그 등 포함)',
            0.00,
            0.00,
            0.00
        );
    ELSE
        -- 기존 Self 채널이 있으면 sub_channels 업데이트
        UPDATE channels
        SET sub_channels = COALESCE(sub_channel_list, ARRAY[]::TEXT[]),
            name = self_channel_name,
            category = 'Self',
            type = 'Self'
        WHERE id = self_channel_id;
    END IF;
END $$;

-- 3. 기존 Self 채널들의 데이터를 Self 통합 채널로 마이그레이션
-- Self 채널 ID 목록을 동적으로 가져와서 업데이트
DO $$
DECLARE
    self_channel_ids TEXT[];
BEGIN
    -- Self 채널 ID 목록 가져오기 (category = 'Own' 또는 type에 'self' 포함)
    SELECT ARRAY_AGG(id) INTO self_channel_ids
    FROM channels
    WHERE category = 'Own'
       OR (type ILIKE '%self%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%kakaotalk%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%blog%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%instagram%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%facebook%' AND category != 'OTA' AND category != 'Partner');
    
    -- self_channel_ids가 비어있지 않으면 마이그레이션 실행
    IF array_length(self_channel_ids, 1) > 0 THEN
        -- reservations 테이블의 channel_id 업데이트 (원래 채널 이름을 sub_channel과 channel_rn에 저장)
        UPDATE reservations r
        SET channel_id = 'SELF',
            channel_rn = COALESCE(r.channel_rn, old_ch.name),
            sub_channel = COALESCE(r.sub_channel, old_ch.name)
        FROM channels old_ch
        WHERE r.channel_id = old_ch.id
          AND old_ch.id = ANY(self_channel_ids)
          AND old_ch.id != 'SELF';
        
        -- customers 테이블의 channel_id 업데이트 (원래 채널 이름을 sub_channel에 저장)
        UPDATE customers c
        SET channel_id = 'SELF',
            sub_channel = COALESCE(c.sub_channel, old_ch.name)
        FROM channels old_ch
        WHERE c.channel_id = old_ch.id
          AND old_ch.id = ANY(self_channel_ids)
          AND old_ch.id != 'SELF';
    END IF;
END $$;

-- dynamic_pricing 테이블의 channel_id 업데이트
-- 주의: 같은 product_id, date에 대해 중복이 발생할 수 있으므로
-- 기존 Self 채널들의 가격 데이터를 하나로 통합하는 로직이 필요할 수 있습니다.
-- 여기서는 단순히 channel_id만 업데이트합니다.
-- 실제로는 서브 채널별로 다른 가격이 필요할 수 있으므로, 
-- dynamic_pricing에 sub_channel 컬럼을 추가하는 것을 고려해볼 수 있습니다.

-- dynamic_pricing 테이블의 channel_id 업데이트
-- 주의: 같은 product_id, date에 대해 중복이 발생할 수 있으므로
-- 기존 Self 채널들의 가격 데이터를 하나로 통합하는 로직이 필요합니다.
DO $$
DECLARE
    pricing_record RECORD;
    conflict_count INTEGER;
    self_channel_ids TEXT[];
BEGIN
    -- Self 채널 ID 목록 가져오기
    SELECT ARRAY_AGG(id) INTO self_channel_ids
    FROM channels
    WHERE category = 'Own'
       OR (type ILIKE '%self%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%kakaotalk%' AND category != 'OTA' AND category != 'Partner')
       OR (name ILIKE '%blog%' AND category != 'OTA' AND category != 'Partner');
    
    IF array_length(self_channel_ids, 1) > 0 THEN
        -- 기존 Self 채널들의 dynamic_pricing을 Self로 통합
        FOR pricing_record IN 
            SELECT DISTINCT dp.product_id, dp.date, dp.channel_id
            FROM dynamic_pricing dp
            INNER JOIN channels ch ON dp.channel_id = ch.id
            WHERE ch.id = ANY(self_channel_ids)
              AND ch.id != 'SELF'
        LOOP
            -- 중복 확인
            SELECT COUNT(*) INTO conflict_count
            FROM dynamic_pricing
            WHERE product_id = pricing_record.product_id
              AND date = pricing_record.date
              AND channel_id = 'SELF';
            
            -- 중복이 없으면 업데이트
            IF conflict_count = 0 THEN
                UPDATE dynamic_pricing
                SET channel_id = 'SELF'
                WHERE product_id = pricing_record.product_id
                  AND date = pricing_record.date
                  AND channel_id = pricing_record.channel_id;
            ELSE
                -- 중복이 있으면 기존 데이터 삭제
                -- 주의: 실제 운영 환경에서는 가격을 병합하거나 우선순위를 정하는 로직이 필요할 수 있습니다.
                DELETE FROM dynamic_pricing
                WHERE product_id = pricing_record.product_id
                  AND date = pricing_record.date
                  AND channel_id = pricing_record.channel_id;
            END IF;
        END LOOP;
    END IF;
END $$;

-- 4. 기존 Self 채널들 처리
-- 주의: 삭제하지 않고 inactive 상태로 변경하여 데이터 보존
-- 실제로 'SELF'로 통합된 채널들만 inactive로 변경
DO $$
DECLARE
    self_channel_ids TEXT[];
    migrated_channel_ids TEXT[];
BEGIN
    -- 실제로 마이그레이션된 Self 채널 ID 목록 가져오기
    -- (customers나 reservations에서 channel_id가 'SELF'로 변경된 원래 채널들)
    SELECT ARRAY_AGG(DISTINCT old_ch.id) INTO migrated_channel_ids
    FROM (
        SELECT DISTINCT c.channel_id as old_id
        FROM customers c
        WHERE c.channel_id != 'SELF' AND c.sub_channel IS NOT NULL
        UNION
        SELECT DISTINCT r.channel_id as old_id
        FROM reservations r
        WHERE r.channel_id != 'SELF' AND r.sub_channel IS NOT NULL
    ) AS migrated
    JOIN channels old_ch ON old_ch.id = migrated.old_id;
    
    -- 또는 마이그레이션 시점에서 Self로 통합된 채널들 찾기
    -- (category = 'Own'이면서 'SELF'가 아닌 채널들 중에서)
    SELECT ARRAY_AGG(id) INTO self_channel_ids
    FROM channels
    WHERE (category = 'Own' OR (type ILIKE '%self%' AND category != 'OTA' AND category != 'Partner'))
       AND id != 'SELF'
       AND (
           EXISTS (SELECT 1 FROM customers WHERE sub_channel IS NOT NULL AND channel_id = 'SELF')
           OR EXISTS (SELECT 1 FROM reservations WHERE sub_channel IS NOT NULL AND channel_id = 'SELF')
       );
    
    -- 마이그레이션된 채널들을 inactive로 변경 (삭제하지 않음)
    IF array_length(self_channel_ids, 1) > 0 THEN
        UPDATE channels
        SET status = 'inactive',
            description = COALESCE(description, '') || ' [통합됨: SELF 채널로 통합]'
        WHERE id = ANY(self_channel_ids)
          AND id != 'SELF';
    END IF;
    
    -- 마이그레이션된 채널 ID가 있으면 그것들도 inactive로 변경
    IF array_length(migrated_channel_ids, 1) > 0 THEN
        UPDATE channels
        SET status = 'inactive',
            description = COALESCE(description, '') || ' [통합됨: SELF 채널로 통합]'
        WHERE id = ANY(migrated_channel_ids)
          AND id != 'SELF';
    END IF;
END $$;

-- 5. 최종 확인을 위한 뷰 생성 (선택사항)
CREATE OR REPLACE VIEW channels_with_sub_channels AS
SELECT 
    id,
    name,
    type,
    category,
    sub_channels,
    array_length(sub_channels, 1) as sub_channel_count,
    website,
    commission,
    base_price,
    markup,
    status,
    description,
    created_at
FROM channels
ORDER BY category, name;

COMMENT ON VIEW channels_with_sub_channels IS '서브 채널 정보를 포함한 채널 뷰';

