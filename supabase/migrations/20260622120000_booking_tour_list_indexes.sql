-- 부킹/투어 관리 페이지 목록 쿼리 가속용 인덱스 보강
--
-- 추가 배경 (클라이언트 핵심 쿼리):
--   * 호텔 부킹 메인:
--       SELECT * FROM tour_hotel_bookings
--        WHERE deletion_requested_at IS NULL
--        ORDER BY check_in_date DESC;
--     → 활성 행만 인덱싱하는 부분 인덱스가 가장 효율적.
--
--   * 투어 관리 카드/달력 페이지네이션:
--       SELECT * FROM tours
--        ORDER BY tour_date DESC, id DESC
--        OFFSET … LIMIT 1000;
--     → (tour_date DESC, id DESC) 복합 인덱스가 정렬·키셋에 직접 사용됨.
--
--   * 투어 달력 예약 범위 조회:
--       SELECT … FROM reservations
--        WHERE product_id IN (…) AND tour_date BETWEEN $1 AND $2;
--     → (product_id, tour_date) 복합 인덱스가 IN+범위 조합에 가장 적합.
--
-- 모두 IF NOT EXISTS 로 멱등 — 이미 동등한 인덱스가 있으면 스킵.

BEGIN;

-- 1) 호텔 부킹: 활성 행 + check_in_date 정렬
CREATE INDEX IF NOT EXISTS idx_tour_hotel_bookings_active_check_in_date
  ON public.tour_hotel_bookings (check_in_date DESC)
  WHERE deletion_requested_at IS NULL;

COMMENT ON INDEX public.idx_tour_hotel_bookings_active_check_in_date IS
  '호텔 부킹 목록(활성 행, check_in_date DESC 정렬) 가속';

-- 2) 투어 페이지네이션: (tour_date DESC, id DESC) 복합 정렬
CREATE INDEX IF NOT EXISTS idx_tours_tour_date_id_desc
  ON public.tours (tour_date DESC, id DESC);

COMMENT ON INDEX public.idx_tours_tour_date_id_desc IS
  '투어 관리 목록 페이지네이션(tour_date DESC, id DESC) 가속';

-- 3) 예약: product_id IN (…) + tour_date 범위
CREATE INDEX IF NOT EXISTS idx_reservations_product_id_tour_date
  ON public.reservations (product_id, tour_date);

COMMENT ON INDEX public.idx_reservations_product_id_tour_date IS
  '투어 달력 예약 조회(product_id IN + tour_date 범위) 가속';

COMMIT;
