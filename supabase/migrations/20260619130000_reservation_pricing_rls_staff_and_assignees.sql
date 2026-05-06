-- Step 2 (RLS hardening): reservation_pricing
-- Replaces FOR ALL USING (true). Read: staff or tour guide/assistant on that reservation.
-- Write: staff only (가이드 앱은 조회만 — TourExpenseManager 등).
-- Depends on: public.reservation_expense_row_accessible_as_assignee (20260619120000).

begin;

drop policy if exists "Allow public access to reservation_pricing" on public.reservation_pricing;

revoke all on table public.reservation_pricing from anon;

create policy "reservation_pricing_select_staff_or_assignee"
  on public.reservation_pricing
  for select
  to authenticated
  using (
    public.is_staff()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

create policy "reservation_pricing_insert_staff"
  on public.reservation_pricing
  for insert
  to authenticated
  with check (public.is_staff());

create policy "reservation_pricing_update_staff"
  on public.reservation_pricing
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "reservation_pricing_delete_staff"
  on public.reservation_pricing
  for delete
  to authenticated
  using (public.is_staff());

commit;
