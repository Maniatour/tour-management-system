-- Tour hotel CC Form follow-up: confirm guest name changed at hotel after CC sent

begin;

alter table public.tour_hotel_bookings
  add column if not exists name_change_confirmed_at timestamptz null,
  add column if not exists name_change_confirmed_by text null;

comment on column public.tour_hotel_bookings.name_change_confirmed_at is
  'When office confirmed with hotel that reservation name was updated after CC form send';

comment on column public.tour_hotel_bookings.name_change_confirmed_by is
  'Staff email who confirmed the hotel reservation name change';

commit;
