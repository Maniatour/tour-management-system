-- Pending 고객 관리 워크플로우: 대체 투어 안내 · 처리 완료(취소/날짜·투어 변경)
begin;

ALTER TABLE reservation_follow_up_pipeline_manual
  ADD COLUMN IF NOT EXISTS pending_alt_tour_notice_manual BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pending_resolution_kind TEXT NULL;

COMMENT ON COLUMN reservation_follow_up_pipeline_manual.pending_alt_tour_notice_manual IS
  'Pending 예약: 대체 투어 안내 완료(수동 표시)';
COMMENT ON COLUMN reservation_follow_up_pipeline_manual.pending_resolution_kind IS
  'Pending 예약 처리: cancel | date_change | tour_change';

commit;
