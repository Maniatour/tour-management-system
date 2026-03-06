-- 투어 통계/리스트 조회 가속: tours 날짜 범위, payment_records 예약별 조회
-- Migration: 20260304100000_add_tour_statistics_indexes

BEGIN;

-- 기간별 투어 조회 (예: 통계 페이지) 가속
CREATE INDEX IF NOT EXISTS idx_tours_tour_date ON tours(tour_date);

-- 예약별 결제 조회 가속 (통계/정산 배치 조회)
CREATE INDEX IF NOT EXISTS idx_payment_records_reservation_id ON payment_records(reservation_id);

COMMIT;
