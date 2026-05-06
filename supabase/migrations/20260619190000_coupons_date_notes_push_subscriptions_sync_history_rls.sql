-- Step 8 (RLS hardening): coupons, date_notes, push_subscriptions (tour chat), sync_history
-- coupons: 활성 행만 anon SELECT (쿠폰 검증 API). 쓰기는 스태프만.
-- push_subscriptions: 투어 채팅 고객(anon)은 활성 방에 한해 구독 CRUD; 스태프는 전체.

begin;

-- ---------- coupons ----------
alter table public.coupons enable row level security;

drop policy if exists "Allow public access" on public.coupons;

revoke all on table public.coupons from anon;
grant select on table public.coupons to anon;

create policy "coupons_anon_select_active"
  on public.coupons for select to anon
  using (lower(trim(coalesce(status, ''))) = 'active');

create policy "coupons_select_staff"
  on public.coupons for select to authenticated
  using (public.is_staff());

create policy "coupons_insert_staff"
  on public.coupons for insert to authenticated
  with check (public.is_staff());

create policy "coupons_update_staff"
  on public.coupons for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "coupons_delete_staff"
  on public.coupons for delete to authenticated
  using (public.is_staff());

-- ---------- date_notes ----------
alter table public.date_notes enable row level security;

drop policy if exists "Allow authenticated users to read date notes" on public.date_notes;
drop policy if exists "Allow authenticated users to insert date notes" on public.date_notes;
drop policy if exists "Allow authenticated users to update date notes" on public.date_notes;
drop policy if exists "Allow authenticated users to delete date notes" on public.date_notes;

revoke all on table public.date_notes from anon;

create policy "date_notes_select_staff"
  on public.date_notes for select to authenticated
  using (public.is_staff());

create policy "date_notes_insert_staff"
  on public.date_notes for insert to authenticated
  with check (public.is_staff());

create policy "date_notes_update_staff"
  on public.date_notes for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "date_notes_delete_staff"
  on public.date_notes for delete to authenticated
  using (public.is_staff());

-- ---------- push_subscriptions (고객 푸시 — anon) ----------
alter table public.push_subscriptions enable row level security;

drop policy if exists "Users can read their own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can create subscriptions" on public.push_subscriptions;
drop policy if exists "Users can delete their own subscriptions" on public.push_subscriptions;
drop policy if exists "Users can update their own subscriptions" on public.push_subscriptions;

revoke all on table public.push_subscriptions from anon;
grant select, insert, update, delete on table public.push_subscriptions to anon;

create policy "push_subscriptions_anon_rw_active_room"
  on public.push_subscriptions for select to anon
  using (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = push_subscriptions.room_id
        and cr.is_active = true
    )
  );

create policy "push_subscriptions_anon_insert_active_room"
  on public.push_subscriptions for insert to anon
  with check (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = room_id
        and cr.is_active = true
    )
  );

create policy "push_subscriptions_anon_update_active_room"
  on public.push_subscriptions for update to anon
  using (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = push_subscriptions.room_id
        and cr.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = room_id
        and cr.is_active = true
    )
  );

create policy "push_subscriptions_anon_delete_active_room"
  on public.push_subscriptions for delete to anon
  using (
    exists (
      select 1 from public.chat_rooms cr
      where cr.id = push_subscriptions.room_id
        and cr.is_active = true
    )
  );

create policy "push_subscriptions_staff_all"
  on public.push_subscriptions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------- sync_history ----------
alter table public.sync_history enable row level security;

drop policy if exists "Anyone can view sync history" on public.sync_history;
drop policy if exists "Authenticated users can insert sync history" on public.sync_history;
drop policy if exists "Authenticated users can update sync history" on public.sync_history;

revoke all on table public.sync_history from anon;

create policy "sync_history_select_staff"
  on public.sync_history for select to authenticated
  using (public.is_staff());

create policy "sync_history_insert_staff"
  on public.sync_history for insert to authenticated
  with check (public.is_staff());

create policy "sync_history_update_staff"
  on public.sync_history for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "sync_history_delete_staff"
  on public.sync_history for delete to authenticated
  using (public.is_staff());

commit;
