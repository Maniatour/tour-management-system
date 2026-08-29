-- Snapshot booked pax + actual departure/return times on tour reports.

alter table public.tour_reports
  add column if not exists booked_customer_count integer,
  add column if not exists actual_departure_time time,
  add column if not exists actual_return_time time;

comment on column public.tour_reports.booked_customer_count is
  '리포트 작성 시점의 배정 예약 인원(취소·삭제 제외). 실제 탑승은 customer_count.';
comment on column public.tour_reports.actual_departure_time is
  '실제 출발 시각(투어일 기준).';
comment on column public.tour_reports.actual_return_time is
  '실제 복귀 시각(투어일 기준).';
