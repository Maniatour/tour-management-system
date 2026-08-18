-- 노쇼 날짜 변경: 실예약 ↔ 구날짜 자리표시 예약 연결

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS date_change_live_reservation_id text NULL,
  ADD COLUMN IF NOT EXISTS date_change_placeholder_reservation_id text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_date_change_live_reservation_id_fkey'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_date_change_live_reservation_id_fkey
      FOREIGN KEY (date_change_live_reservation_id)
      REFERENCES public.reservations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_date_change_placeholder_reservation_id_fkey'
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_date_change_placeholder_reservation_id_fkey
      FOREIGN KEY (date_change_placeholder_reservation_id)
      REFERENCES public.reservations(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_date_change_live
  ON public.reservations (date_change_live_reservation_id)
  WHERE date_change_live_reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_date_change_placeholder
  ON public.reservations (date_change_placeholder_reservation_id)
  WHERE date_change_placeholder_reservation_id IS NOT NULL;

COMMENT ON COLUMN public.reservations.date_change_live_reservation_id IS
  'date_changed 자리표시 예약이 가리키는 실제 탑승 예약';
COMMENT ON COLUMN public.reservations.date_change_placeholder_reservation_id IS
  '날짜 변경된 실예약이 가리키는 구날짜 자리표시 예약';
