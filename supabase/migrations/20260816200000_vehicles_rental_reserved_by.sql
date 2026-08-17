-- 렌터카 예약자(픽업 담당) — team.email
alter table public.vehicles
  add column if not exists rental_reserved_by text;

comment on column public.vehicles.rental_reserved_by is
  'Team member email who reserved this rental car (pickup assignee).';

create index if not exists vehicles_rental_reserved_by_idx
  on public.vehicles (rental_reserved_by)
  where rental_reserved_by is not null;
