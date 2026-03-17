-- 투어별 오피스 팁 정산 완료 기록
ALTER TABLE tour_office_tips
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN tour_office_tips.settled_at IS '팁 정산 완료 시각 (null이면 미정산)';
