-- Fix RLS policies to work with empty current_email()
-- This allows data sync to work by temporarily allowing all operations

begin;

-- Drop existing policies
drop policy if exists "reservations_insert_staff" on public.reservations;
drop policy if exists "reservations_update_staff" on public.reservations;
drop policy if exists "reservations_delete_staff" on public.reservations;

-- Create new policies that allow all operations (temporary for data sync)
create policy "reservations_insert_all" on public.reservations
  for insert
  with check (true);

create policy "reservations_update_all" on public.reservations
  for update
  using (true)
  with check (true);

create policy "reservations_delete_all" on public.reservations
  for delete
  using (true);

-- Also fix the current_email function to handle empty JWT
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
$$;

commit;
