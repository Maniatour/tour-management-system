-- 간단 카드 Follow-up 파이프라인: 이메일 로그 외 채널(카톡 등)으로 처리했을 때 수동 완료 표시
begin;

CREATE TABLE IF NOT EXISTS reservation_follow_up_pipeline_manual (
  reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
  confirmation_manual BOOLEAN NOT NULL DEFAULT FALSE,
  resident_manual BOOLEAN NOT NULL DEFAULT FALSE,
  departure_manual BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_manual BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_follow_up_pipeline_manual_updated_at
  ON reservation_follow_up_pipeline_manual (updated_at DESC);

ALTER TABLE reservation_follow_up_pipeline_manual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to reservation_follow_up_pipeline_manual"
  ON reservation_follow_up_pipeline_manual
  FOR ALL
  USING (true)
  WITH CHECK (true);

commit;
