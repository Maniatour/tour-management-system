-- Add INSERT policy for reservations table
-- Allows staff to insert reservations for data sync

begin;

-- Add INSERT policy for reservations - staff can insert
create policy "reservations_insert_staff" on public.reservations
  for insert
  with check (
    public.is_staff(public.current_email())
  );

-- Add UPDATE policy for reservations - staff can update
create policy "reservations_update_staff" on public.reservations
  for update
  using (
    public.is_staff(public.current_email())
  )
  with check (
    public.is_staff(public.current_email())
  );

-- Add DELETE policy for reservations - staff can delete
create policy "reservations_delete_staff" on public.reservations
  for delete
  using (
    public.is_staff(public.current_email())
  );

commit;
