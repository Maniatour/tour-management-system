-- 전역 리소스(CPU/IO) 부담 완화: 자주 쓰는 목록·정산 패턴용 보조 인덱스
--
-- 1) 예약 전량 훅: created_at DESC 정렬 + soft-delete 제외 — 부분 인덱스로 인덱스 크기·유지비용 감소
-- 2) 정산·리포트: payment_records submit_on 구간 + payment_status IN (…)

BEGIN;

CREATE INDEX IF NOT EXISTS idx_reservations_active_created_at_id_desc
  ON public.reservations (created_at DESC, id DESC)
  WHERE status IS DISTINCT FROM 'deleted';

CREATE INDEX IF NOT EXISTS idx_reservations_active_tour_date
  ON public.reservations (tour_date)
  WHERE status IS DISTINCT FROM 'deleted';

CREATE INDEX IF NOT EXISTS idx_payment_records_submit_on_payment_status
  ON public.payment_records (submit_on, payment_status);

COMMIT;
