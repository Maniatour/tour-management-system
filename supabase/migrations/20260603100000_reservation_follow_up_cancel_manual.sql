-- 취소 예약 Follow-up: 내부 취소 안내 완료 · 홈페이지 재예약 권유 연락 완료 (수동 표시)
begin;

ALTER TABLE reservation_follow_up_pipeline_manual
  ADD COLUMN IF NOT EXISTS cancel_follow_up_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancel_rebooking_outreach_manual BOOLEAN NOT NULL DEFAULT FALSE;

commit;
