-- 이메일 자동 추가 예약: 관리자가 카드에서 확인하고 저장할 때까지 강조
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS import_needs_review BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.reservations.import_needs_review IS
  '이메일 자동 추가 예약. 관리자가 예약 내용을 확인하고 저장하면 false.';

UPDATE public.reservations
SET import_needs_review = true
WHERE added_by = 'system:email-auto-import'
  AND import_needs_review = false
  AND tour_date >= CURRENT_DATE
  AND COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'deleted', 'completed', 'no_show', 'date_changed');
