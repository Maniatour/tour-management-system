-- 대체 방문 기록(계획 포인트 미방문 시 다른 코스 방문 등)
ALTER TABLE tour_reports
ADD COLUMN IF NOT EXISTS main_stop_substitutions JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN tour_reports.main_stop_substitutions IS '투어 코스 ID -> 대체 방문/메모 (planned 대비 실제)';
