-- 예약 취소 사유 및 연락 기록 (취소/ pending follow-up)
-- Migration: 20260207000000_create_reservation_follow_ups.sql

begin;

CREATE TABLE IF NOT EXISTS reservation_follow_ups (
  id TEXT DEFAULT gen_random_uuid()::text PRIMARY KEY,
  reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('cancellation_reason', 'contact')),
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_reservation_follow_ups_reservation_id ON reservation_follow_ups(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_follow_ups_type ON reservation_follow_ups(type);
CREATE INDEX IF NOT EXISTS idx_reservation_follow_ups_created_at ON reservation_follow_ups(created_at DESC);

ALTER TABLE reservation_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to reservation_follow_ups" ON reservation_follow_ups FOR ALL USING (true);

commit;
