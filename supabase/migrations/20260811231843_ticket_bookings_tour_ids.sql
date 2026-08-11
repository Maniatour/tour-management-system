-- ticket_bookings: 다중 투어 연결 (tour_ids). tour_id 는 대표(첫 번째) 호환용으로 유지.

ALTER TABLE public.ticket_bookings
  ADD COLUMN IF NOT EXISTS tour_ids text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.ticket_bookings.tour_ids IS
  '연결된 투어 ID 목록(순서 유지). tour_id 는 대표(첫 요소) 호환 필드.';

-- 기존 tour_id → tour_ids 백필
UPDATE public.ticket_bookings
SET tour_ids = ARRAY[tour_id]
WHERE tour_id IS NOT NULL
  AND btrim(tour_id) <> ''
  AND (tour_ids IS NULL OR cardinality(tour_ids) = 0);

CREATE INDEX IF NOT EXISTS idx_ticket_bookings_tour_ids_gin
  ON public.ticket_bookings
  USING gin (tour_ids);
