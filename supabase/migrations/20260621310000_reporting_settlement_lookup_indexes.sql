-- 통계·리포트·채널 정산 배치 조회용 인덱스 보강
--
-- 기존 마이그레이션에서 이미 확인된 인덱스(중복 생성 방지 위해 IF NOT EXISTS만 사용):
--   - reservation_pricing: reservation_id (UNIQUE reservation_pricing_reservation_id_unique + idx_reservation_pricing_reservation_id)
--   - reservation_options: idx_reservation_options_reservation_id (20250101000102)
--   - payment_records: idx_payment_records_reservation_id (20260304100000)
--   - reservation_expenses: idx_reservation_expenses_reservation_id (202501200000 등)
--   - tour_expenses: idx_tour_expenses_tour_id (restore / 509170015)
--
-- 본 파일: reservations 투어일·채널+투어일 범위 스캔 가속 + 위 자식 테이블은 부분 복구 DB 대비 idempotent 재보장

BEGIN;

-- 신규: 투어일 기준 필터·정렬 (통계 UI가 전량 로드하더라도 향후 서버 쿼리·JOIN에 유리)
CREATE INDEX IF NOT EXISTS idx_reservations_tour_date
  ON public.reservations (tour_date);

-- 신규: 채널별 + 투어일 구간 (채널 정산·기간 필터 패턴)
CREATE INDEX IF NOT EXISTS idx_reservations_channel_id_tour_date
  ON public.reservations (channel_id, tour_date);

-- 자식 테이블: 예약 ID IN (…) 조회 — 이미 있으면 스킵
CREATE INDEX IF NOT EXISTS idx_reservation_options_reservation_id
  ON public.reservation_options (reservation_id);

CREATE INDEX IF NOT EXISTS idx_payment_records_reservation_id
  ON public.payment_records (reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_expenses_reservation_id
  ON public.reservation_expenses (reservation_id);

CREATE INDEX IF NOT EXISTS idx_tour_expenses_tour_id
  ON public.tour_expenses (tour_id);

COMMIT;
