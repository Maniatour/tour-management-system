-- 스케줄 디스플레이 API: operator_id + tour_date 범위 조회 가속

CREATE INDEX IF NOT EXISTS idx_tours_operator_id_tour_date
  ON public.tours (operator_id, tour_date);

COMMENT ON INDEX public.idx_tours_operator_id_tour_date IS
  '스케줄 디스플레이·월간 스케줄: operator_id = ? AND tour_date BETWEEN ? AND ?';

CREATE INDEX IF NOT EXISTS idx_reservations_operator_id_tour_date
  ON public.reservations (operator_id, tour_date);

COMMENT ON INDEX public.idx_reservations_operator_id_tour_date IS
  '스케줄 디스플레이: operator_id + tour_date 범위 예약 조회';

-- OTA 달력: product_id + inventory_date 범위 (채널·variant 무관 product·일 단위 스캔)
CREATE INDEX IF NOT EXISTS idx_ota_channel_inventory_product_inventory_date
  ON public.ota_channel_inventory (product_id, inventory_date);

COMMENT ON INDEX public.idx_ota_channel_inventory_product_inventory_date IS
  '스케줄 디스플레이 OTA 판매 상태: product_id IN (...) AND inventory_date 범위';
