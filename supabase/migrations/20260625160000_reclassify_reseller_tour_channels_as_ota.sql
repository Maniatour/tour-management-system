-- Exciting Tour 등 리셀러·제휴 투어사는 Own으로 복구된 경우가 있어 OTA로 재분류
-- (예약 통계 · 채널별 정산의 OTA/자체 구분과 일치)

UPDATE channels
SET
  type = 'OTA',
  category = 'OTA',
  description = COALESCE(description, '') || CASE
    WHEN description IS NULL OR description = '' THEN '정산 통계용 OTA 분류'
    WHEN description NOT LIKE '%정산 통계용 OTA 분류%' THEN ' · 정산 통계용 OTA 분류'
    ELSE ''
  END
WHERE (
    name ILIKE '%Exciting Tour%'
    OR name ILIKE '%LTE Tour%'
    OR name ILIKE '%Chowon Tour%'
    OR name ILIKE '%Navajo Kim%'
  )
  AND (
    COALESCE(category, '') IS DISTINCT FROM 'OTA'
    OR COALESCE(type, '') NOT ILIKE 'ota'
  );

-- SELF 통합 채널 sub_channels에서 리셀러 이름 제거 (자체 직판만 유지)
UPDATE channels
SET sub_channels = COALESCE(
  (
    SELECT array_agg(elem ORDER BY elem)
    FROM unnest(sub_channels) AS elem
    WHERE lower(trim(elem)) NOT LIKE '%exciting tour%'
      AND lower(trim(elem)) NOT LIKE '%lte tour%'
      AND lower(trim(elem)) NOT LIKE '%chowon tour%'
      AND lower(trim(elem)) NOT LIKE '%navajo kim%'
  ),
  ARRAY[]::text[]
)
WHERE id = 'SELF'
  AND sub_channels IS NOT NULL
  AND array_length(sub_channels, 1) > 0;
