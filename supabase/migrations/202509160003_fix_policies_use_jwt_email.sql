-- Fix RLS policies to read email from JWT instead of non-existent auth.email()
-- Adds helper current_email() and recreates policies

begin;

-- Helper: get current authenticated email (lowercased)
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- Ensure RLS enabled
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tours') then
    execute 'alter table public.tours enable row level security';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='reservations') then
    execute 'alter table public.reservations enable row level security';
  end if;
end$$;

-- Drop old policies if exist
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tours' and policyname='tours_select_assigned_or_staff'
  ) then
    drop policy "tours_select_assigned_or_staff" on public.tours;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservations' and policyname='reservations_select_staff_all'
  ) then
    drop policy "reservations_select_staff_all" on public.reservations;
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservations' and policyname='reservations_select_assigned_via_tour'
  ) then
    drop policy "reservations_select_assigned_via_tour" on public.reservations;
  end if;
end$$;

-- Recreate with JWT email
create policy "tours_select_assigned_or_staff" on public.tours
  for select
  using (
    public.is_staff(public.current_email())
    or lower(coalesce(tour_guide_id, '')) = public.current_email()
    or lower(coalesce(assistant_id, '')) = public.current_email()
  );

create policy "reservations_select_staff_all" on public.reservations
  for select
  using (
    public.is_staff(public.current_email())
  );

create policy "reservations_select_assigned_via_tour" on public.reservations
  for select
  using (
    exists (
      select 1 from public.tours t
      where t.id = reservations.tour_id
        and (
          public.is_staff(public.current_email())
          or lower(coalesce(t.tour_guide_id, '')) = public.current_email()
          or lower(coalesce(t.assistant_id, '')) = public.current_email()
        )
    )
  );

commit;


