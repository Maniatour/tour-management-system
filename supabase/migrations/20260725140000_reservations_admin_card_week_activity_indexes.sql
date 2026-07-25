-- 예약 관리 card-week 활동 구간 조회:
-- operator_id + (created_at OR updated_at) 범위 필터·정렬 가속
--
-- PostgREST 패턴:
--   .eq('operator_id', …)
--   .neq('status', 'deleted')  (또는 status = …)
--   .or('and(created_at.gte…,created_at.lte…),and(updated_at.gte…,updated_at.lte…)')

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reservations_operator_active_created_at_id_desc
  ON public.reservations (operator_id, created_at DESC, id DESC)
  WHERE status IS DISTINCT FROM 'deleted';

CREATE INDEX IF NOT EXISTS idx_reservations_operator_active_updated_at_id_desc
  ON public.reservations (operator_id, updated_at DESC, id DESC)
  WHERE status IS DISTINCT FROM 'deleted';

COMMENT ON INDEX public.idx_reservations_operator_active_created_at_id_desc IS
  'Admin card-week: tenant + created_at activity window + created_at/id sort';

COMMENT ON INDEX public.idx_reservations_operator_active_updated_at_id_desc IS
  'Admin card-week: tenant + updated_at activity window (OR branch with created_at index)';

COMMIT;
