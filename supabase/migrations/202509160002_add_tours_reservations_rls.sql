-- Enable RLS and add policies for tours and reservations
-- Admin/staff can see all; guides/assistants can see only assigned tours and related reservations

begin;

-- Ensure RLS enabled on tours
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tours'
  ) then
    execute 'alter table public.tours enable row level security';
  end if;
end$$;

-- tours select policy: staff or assigned
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tours' and policyname = 'tours_select_assigned_or_staff'
  ) then
    create policy "tours_select_assigned_or_staff" on public.tours
      for select
      using (
        public.is_staff(auth.email())
        or tour_guide_id = auth.email()
        or assistant_id = auth.email()
      );
  end if;
end$$;

-- Ensure RLS enabled on reservations
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'reservations'
  ) then
    execute 'alter table public.reservations enable row level security';
  end if;
end$$;

-- reservations select policy: staff can see all
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reservations' and policyname = 'reservations_select_staff_all'
  ) then
    create policy "reservations_select_staff_all" on public.reservations
      for select
      using (
        public.is_staff(auth.email())
      );
  end if;
end$$;

-- reservations select policy: guides/assistants can see reservations via assigned tour
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'reservations' and policyname = 'reservations_select_assigned_via_tour'
  ) then
    create policy "reservations_select_assigned_via_tour" on public.reservations
      for select
      using (
        exists (
          select 1 from public.tours t
          where t.id = reservations.tour_id
            and (
              public.is_staff(auth.email())
              or t.tour_guide_id = auth.email()
              or t.assistant_id = auth.email()
            )
        )
      );
  end if;
end$$;

commit;


