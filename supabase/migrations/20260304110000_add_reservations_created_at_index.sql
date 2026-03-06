-- 예약 목록 카드뷰 조회 가속: created_at 내림차순 정렬
-- Migration: 20260304110000_add_reservations_created_at_index

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reservations_created_at_desc ON reservations(created_at DESC);

COMMIT;
