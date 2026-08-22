-- Split hotel booking names: booker (from login email), check-in guest, Wyndham account

begin;

alter table public.tour_hotel_bookings
  add column if not exists booker_name text,
  add column if not exists wyndham_account_name text;

comment on column public.tour_hotel_bookings.booker_name is
  'Staff who made the hotel reservation; auto-filled from login email / team name';

comment on column public.tour_hotel_bookings.wyndham_account_name is
  'Name on the Wyndham login account used to book';

comment on column public.tour_hotel_bookings.reservation_name is
  'Check-in guest name (person who will check in at the hotel)';

update public.tour_hotel_bookings thb
set booker_name = coalesce(nullif(trim(t.name_ko), ''), nullif(trim(t.name_en), ''))
from public.team t
where thb.booker_name is null
  and thb.submitted_by is not null
  and length(trim(thb.submitted_by)) > 0
  and lower(trim(thb.submitted_by)) = lower(trim(t.email));

commit;
