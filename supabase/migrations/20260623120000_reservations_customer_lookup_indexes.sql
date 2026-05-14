-- 고객별 예약 목록·대시보드: customer_id + tour_date DESC 정렬
-- 관리 검색: tour_time eq (`src/lib/adminReservationListFetch.ts`)
--
-- 참고: `reservations.customer_email` 은 일부 DB/스키마에 없음 — 컬럼 추가 후
--       별도 마이그레이션으로 btree 인덱스를 두는 것이 안전함.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reservations_customer_id_tour_date_desc
  ON public.reservations (customer_id, tour_date DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_tour_time
  ON public.reservations (tour_time);

COMMIT;
