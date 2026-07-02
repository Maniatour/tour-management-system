-- 픽업 그룹 프리셋 (8호텔/10호텔/15호텔 그룹 등)
CREATE TABLE IF NOT EXISTS pickup_group_presets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name_ko TEXT NOT NULL,
  name_en TEXT,
  group_count INTEGER NOT NULL CHECK (group_count > 0 AND group_count <= 99),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pickup_group_preset_representatives (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  preset_id TEXT NOT NULL REFERENCES pickup_group_presets(id) ON DELETE CASCADE,
  group_index INTEGER NOT NULL CHECK (group_index > 0),
  representative_hotel_id TEXT REFERENCES pickup_hotels(id) ON DELETE SET NULL,
  UNIQUE (preset_id, group_index)
);

CREATE INDEX IF NOT EXISTS idx_pickup_group_preset_reps_preset
  ON pickup_group_preset_representatives(preset_id);

ALTER TABLE tours
  ADD COLUMN IF NOT EXISTS pickup_group_preset_id TEXT REFERENCES pickup_group_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_group_mode_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tours.pickup_group_preset_id IS
  '픽업 그룹 프리셋 ID. NULL이면 요청 호텔 픽업(또는 use_representative_pickup 레거시).';
COMMENT ON COLUMN tours.pickup_group_mode_overrides IS
  '그룹별 픽업 모드. 키=그룹 번호 문자열, 값=representative|requested';

-- updated_at trigger for presets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_pickup_group_presets_updated_at'
      AND event_object_table = 'pickup_group_presets'
  ) THEN
    CREATE TRIGGER update_pickup_group_presets_updated_at
      BEFORE UPDATE ON pickup_group_presets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS (pickup_hotels와 동일: staff 관리, team 조회)
ALTER TABLE pickup_group_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_group_preset_representatives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON pickup_group_presets FROM anon;
REVOKE ALL ON pickup_group_preset_representatives FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON pickup_group_presets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pickup_group_preset_representatives TO authenticated;

DROP POLICY IF EXISTS "pickup_group_presets_select_team" ON pickup_group_presets;
DROP POLICY IF EXISTS "pickup_group_presets_write_staff" ON pickup_group_presets;
DROP POLICY IF EXISTS "pickup_group_preset_reps_select_team" ON pickup_group_preset_representatives;
DROP POLICY IF EXISTS "pickup_group_preset_reps_write_staff" ON pickup_group_preset_representatives;

CREATE POLICY "pickup_group_presets_select_team"
  ON pickup_group_presets FOR SELECT TO authenticated
  USING (public.is_team_member(public.current_email()));

CREATE POLICY "pickup_group_presets_write_staff"
  ON pickup_group_presets FOR ALL TO authenticated
  USING (public.is_staff(public.current_email()))
  WITH CHECK (public.is_staff(public.current_email()));

CREATE POLICY "pickup_group_preset_reps_select_team"
  ON pickup_group_preset_representatives FOR SELECT TO authenticated
  USING (public.is_team_member(public.current_email()));

CREATE POLICY "pickup_group_preset_reps_write_staff"
  ON pickup_group_preset_representatives FOR ALL TO authenticated
  USING (public.is_staff(public.current_email()))
  WITH CHECK (public.is_staff(public.current_email()));

-- 기본 프리셋 (대표 호텔은 관리 화면에서 지정)
INSERT INTO pickup_group_presets (id, name_ko, name_en, group_count, sort_order)
VALUES
  ('pickup-preset-8', '8호텔 그룹', '8 Hotel Group', 8, 10),
  ('pickup-preset-10', '10호텔 그룹', '10 Hotel Group', 10, 20),
  ('pickup-preset-15', '15호텔 그룹', '15 Hotel Group', 15, 30)
ON CONFLICT (id) DO NOTHING;
