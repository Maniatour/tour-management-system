-- Normalize email comparisons with btrim/lower to avoid whitespace/case issues

begin;

-- 1) Make current_email() trimmed & lowercased consistently
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

-- 2) Recreate policies using lower(btrim(...)) for guide/assistant ids
do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tours' and policyname='tours_select_assigned_or_staff'
  ) then
    drop policy "tours_select_assigned_or_staff" on public.tours;
  end if;

  create policy "tours_select_assigned_or_staff" on public.tours
    for select
    using (
      public.is_staff(public.current_email())
      or lower(btrim(coalesce(tour_guide_id, ''))) = public.current_email()
      or lower(btrim(coalesce(assistant_id, ''))) = public.current_email()
    );

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservations' and policyname='reservations_select_staff_all'
  ) then
    drop policy "reservations_select_staff_all" on public.reservations;
  end if;

  create policy "reservations_select_staff_all" on public.reservations
    for select
    using (
      public.is_staff(public.current_email())
    );

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='reservations' and policyname='reservations_select_assigned_via_tour'
  ) then
    drop policy "reservations_select_assigned_via_tour" on public.reservations;
  end if;

  create policy "reservations_select_assigned_via_tour" on public.reservations
    for select
    using (
      exists (
        select 1 from public.tours t
        where t.id = reservations.tour_id
          and (
            public.is_staff(public.current_email())
            or lower(btrim(coalesce(t.tour_guide_id, ''))) = public.current_email()
            or lower(btrim(coalesce(t.assistant_id, ''))) = public.current_email()
          )
      )
    );
end$$;

commit;


