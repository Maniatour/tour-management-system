-- 렌터카 픽업·반납 시각 (확인서 OCR / 스케줄 호버)
alter table public.vehicles
  add column if not exists rental_pickup_time time,
  add column if not exists rental_return_time time;

comment on column public.vehicles.rental_pickup_time is
  'Scheduled rental pickup time (local).';
comment on column public.vehicles.rental_return_time is
  'Scheduled rental return time (local).';
