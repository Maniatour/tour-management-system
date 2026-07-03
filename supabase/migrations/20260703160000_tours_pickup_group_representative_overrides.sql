ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS pickup_group_representative_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tours.pickup_group_representative_overrides IS
  '투어별 그룹 대표 픽업 호텔. 키=그룹 번호 문자열, 값=pickup_hotels.id';
