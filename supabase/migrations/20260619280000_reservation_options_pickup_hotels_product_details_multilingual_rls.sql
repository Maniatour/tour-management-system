-- Step 16 (RLS hardening): reservation_options, pickup_hotels,
--   product_details_multilingual, product_details_common_multilingual
-- Depends: public.is_staff(text), public.current_email(), public.is_team_member(text),
--   public.reservation_expense_row_accessible_as_assignee (20260619120000).

begin;

-- ---------- reservation_options ----------
alter table public.reservation_options enable row level security;

drop policy if exists "Enable all access for reservation_options" on public.reservation_options;

revoke all on table public.reservation_options from anon;
grant select, insert, update, delete on table public.reservation_options to authenticated;

create policy "reservation_options_select"
  on public.reservation_options for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_options_insert"
  on public.reservation_options for insert to authenticated
  with check (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_options_update"
  on public.reservation_options for update to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_options_delete"
  on public.reservation_options for delete to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

-- ---------- pickup_hotels (기존 RLS 없음) ----------
alter table public.pickup_hotels enable row level security;

drop policy if exists "pickup_hotels_select_team" on public.pickup_hotels;
drop policy if exists "pickup_hotels_insert_staff" on public.pickup_hotels;
drop policy if exists "pickup_hotels_update_staff" on public.pickup_hotels;
drop policy if exists "pickup_hotels_delete_staff" on public.pickup_hotels;

revoke all on table public.pickup_hotels from anon;
grant select, insert, update, delete on table public.pickup_hotels to authenticated;

create policy "pickup_hotels_select_team"
  on public.pickup_hotels for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "pickup_hotels_insert_staff"
  on public.pickup_hotels for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "pickup_hotels_update_staff"
  on public.pickup_hotels for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "pickup_hotels_delete_staff"
  on public.pickup_hotels for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_details_multilingual ----------
alter table public.product_details_multilingual enable row level security;

drop policy if exists "Allow all operations on product_details_multilingual for authenticated users"
  on public.product_details_multilingual;
drop policy if exists "Allow public read access to product_details_multilingual"
  on public.product_details_multilingual;
drop policy if exists "product_details_multilingual_select_team" on public.product_details_multilingual;
drop policy if exists "product_details_multilingual_select_anon" on public.product_details_multilingual;
drop policy if exists "product_details_multilingual_insert_staff" on public.product_details_multilingual;
drop policy if exists "product_details_multilingual_update_staff" on public.product_details_multilingual;
drop policy if exists "product_details_multilingual_delete_staff" on public.product_details_multilingual;

revoke all on table public.product_details_multilingual from anon;
grant select on table public.product_details_multilingual to anon;
grant select, insert, update, delete on table public.product_details_multilingual to authenticated;

create policy "product_details_multilingual_select_anon"
  on public.product_details_multilingual for select to anon
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_details_multilingual.product_id
    )
  );

create policy "product_details_multilingual_select_team"
  on public.product_details_multilingual for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_details_multilingual_insert_staff"
  on public.product_details_multilingual for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_details_multilingual_update_staff"
  on public.product_details_multilingual for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_details_multilingual_delete_staff"
  on public.product_details_multilingual for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_details_common_multilingual ----------
alter table public.product_details_common_multilingual enable row level security;

drop policy if exists "Allow all operations on product_details_common_multilingual for authenticated users"
  on public.product_details_common_multilingual;
drop policy if exists "product_details_common_multilingual_select_team" on public.product_details_common_multilingual;
drop policy if exists "product_details_common_multilingual_insert_staff" on public.product_details_common_multilingual;
drop policy if exists "product_details_common_multilingual_update_staff" on public.product_details_common_multilingual;
drop policy if exists "product_details_common_multilingual_delete_staff" on public.product_details_common_multilingual;

revoke all on table public.product_details_common_multilingual from anon;
grant select, insert, update, delete on table public.product_details_common_multilingual to authenticated;

create policy "product_details_common_multilingual_select_team"
  on public.product_details_common_multilingual for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_details_common_multilingual_insert_staff"
  on public.product_details_common_multilingual for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_details_common_multilingual_update_staff"
  on public.product_details_common_multilingual for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_details_common_multilingual_delete_staff"
  on public.product_details_common_multilingual for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
