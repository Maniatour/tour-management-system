-- 가격 변경 등 재부킹 시 이전 취소된 부킹과 연결
begin;

alter table public.tour_hotel_bookings
  add column if not exists replaces_booking_id text;

comment on column public.tour_hotel_bookings.replaces_booking_id is
  '가격 변경 등으로 이 부킹이 대체한 이전 tour_hotel_bookings.id';

create index if not exists tour_hotel_bookings_replaces_booking_id_idx
  on public.tour_hotel_bookings (replaces_booking_id)
  where replaces_booking_id is not null;

commit;
