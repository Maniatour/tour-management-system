-- 채널 상태 수정 마이그레이션
-- 비활성화된 채널들을 적절히 활성화
-- Migration: 20250123000003_fix_channel_status

-- 1. 현재 상태 확인
SELECT 
    '현재 채널 상태 확인' as section,
    id,
    name,
    category,
    type,
    status,
    sub_channels
FROM channels
ORDER BY category, status, name;

-- 2. OTA 채널들은 모두 활성화 (Self로 통합되지 않은 채널들)
UPDATE channels
SET status = 'active'
WHERE category = 'OTA'
  AND status = 'inactive';

-- 3. Partner 채널들도 활성화
UPDATE channels
SET status = 'active'
WHERE category = 'Partner'
  AND status = 'inactive';

-- 4. SELF 통합 채널은 활성화
UPDATE channels
SET status = 'active'
WHERE id = 'SELF';

-- 5. Own 카테고리 채널 중에서:
--    - SELF로 통합된 개별 서브 채널들은 inactive 유지 (정상)
--    - SELF가 아닌 Own 채널들은 활성화 (직접 방문 등)
--    주의: 복구된 서브 채널들(M00004, M00010 등)은 inactive로 유지하는 것이 정상
UPDATE channels
SET status = 'active'
WHERE category = 'Own'
  AND id != 'SELF'
  AND status = 'inactive'
  AND NOT (
      -- SELF 채널의 sub_channels에 포함된 채널들은 제외 (이들은 inactive로 유지)
      EXISTS (
          SELECT 1 
          FROM channels self_ch
          WHERE self_ch.id = 'SELF'
            AND self_ch.sub_channels IS NOT NULL
            AND channels.name = ANY(self_ch.sub_channels)
      )
      -- 또는 ID가 M으로 시작하는 복구된 채널들 (M00004, M00010 등)
      OR id LIKE 'M%'
      OR id LIKE 'B%'
      OR id = 'ETC'
  );

-- 6. Self 카테고리 채널 중 SELF가 아닌 것은 활성화
UPDATE channels
SET status = 'active'
WHERE category = 'Self'
  AND id != 'SELF'
  AND status = 'inactive';

-- 7. 최종 상태 확인
SELECT 
    '수정 후 채널 상태' as section,
    id,
    name,
    category,
    type,
    status,
    sub_channels,
    CASE 
        WHEN id = 'SELF' THEN '통합 채널'
        WHEN status = 'inactive' AND category = 'Own' THEN '서브 채널 (비활성화됨)'
        ELSE '활성 채널'
    END as description
FROM channels
ORDER BY 
    CASE status
        WHEN 'active' THEN 1
        WHEN 'inactive' THEN 2
        ELSE 3
    END,
    category,
    name;

-- 8. 활성 채널 개수 확인
SELECT 
    '활성 채널 통계' as section,
    category,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
    COUNT(*) as total_count
FROM channels
GROUP BY category
ORDER BY category;

