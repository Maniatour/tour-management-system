-- Step 15 (RLS hardening): tour_photos, email_logs, chat_bans, product_schedules
-- Depends: public.is_staff(text), public.current_email(), public.is_team_member(text),
--   public.tour_expense_row_accessible_as_assignee, public.reservation_expense_row_accessible_as_assignee.

begin;

-- ---------- Helper: 공개 갤러리/업로드 허용 투어 (앱 7일·photos_extended_access 와 정렬, 1일 버퍼) ----------
create or replace function public.tour_photo_public_album_accessible(p_tour_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_tour_id is not null
  and length(trim(p_tour_id)) > 0
  and exists (
    select 1
    from public.tours t
    where t.id = p_tour_id
      and (
        coalesce(t.photos_extended_access, false)
        or (
          t.tour_date is not null
          and (t.tour_date::date) >= ((timezone('utc', now()))::date - 8)
        )
      )
  );
$$;

comment on function public.tour_photo_public_album_accessible(text) is
  'RLS: 고객 공개 사진 페이지(anon)에서 조회·업로드 가능한 투어(연장 플래그 또는 투어일 기준 8일 이내)';

-- ---------- tour_photos ----------
alter table public.tour_photos enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname as pname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tour_photos'
  loop
    execute format('drop policy if exists %I on public.tour_photos', r.pname);
  end loop;
end$$;

revoke all on table public.tour_photos from anon;
grant select, insert, update, delete on table public.tour_photos to authenticated;
grant select, insert on table public.tour_photos to anon;

-- 팀·스태프·가이드: 전체 메타 조회
create policy "tour_photos_select_team"
  on public.tour_photos for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(coalesce(uploaded_by, ''))) = public.current_email()
  );

-- anon: 공개 앨범 투어이거나, 공유 플래그가 있는 행
create policy "tour_photos_anon_select"
  on public.tour_photos for select to anon
  using (
    public.tour_photo_public_album_accessible(tour_id)
    or (
      coalesce(is_public, false) = true
      and share_token is not null
      and length(trim(share_token)) > 0
    )
  );

create policy "tour_photos_insert_team"
  on public.tour_photos for insert to authenticated
  with check (
    public.is_staff(public.current_email())
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or public.is_team_member(public.current_email())
  );

create policy "tour_photos_anon_insert"
  on public.tour_photos for insert to anon
  with check (
    public.tour_photo_public_album_accessible(tour_id)
    and share_token is not null
    and length(trim(share_token)) > 0
    and concat(tour_id, '/') = left(file_path, length(tour_id) + 1)
  );

create policy "tour_photos_update_team"
  on public.tour_photos for update to authenticated
  using (
    public.is_staff(public.current_email())
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(coalesce(uploaded_by, ''))) = public.current_email()
  )
  with check (
    public.is_staff(public.current_email())
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(coalesce(uploaded_by, ''))) = public.current_email()
  );

create policy "tour_photos_delete_team"
  on public.tour_photos for delete to authenticated
  using (
    public.is_staff(public.current_email())
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(coalesce(uploaded_by, ''))) = public.current_email()
  );

-- ---------- email_logs (서버는 supabaseAdmin으로 INSERT/UPDATE) ----------
alter table public.email_logs enable row level security;

drop policy if exists "Admins can view all email logs" on public.email_logs;
drop policy if exists "System can insert email logs" on public.email_logs;

revoke all on table public.email_logs from anon;
revoke insert, update, delete on table public.email_logs from authenticated;
grant select on table public.email_logs to authenticated;

create policy "email_logs_select_staff_team_or_assignee"
  on public.email_logs for select to authenticated
  using (
    public.is_staff(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

-- ---------- chat_bans ----------
alter table public.chat_bans enable row level security;

drop policy if exists "chat_bans_public_read" on public.chat_bans;
drop policy if exists "chat_bans_select_active_room" on public.chat_bans;
drop policy if exists "chat_bans_select" on public.chat_bans;
drop policy if exists "chat_bans_insert_staff" on public.chat_bans;
drop policy if exists "chat_bans_update_staff" on public.chat_bans;
drop policy if exists "chat_bans_delete_staff" on public.chat_bans;
drop policy if exists "chat_bans_staff_all" on public.chat_bans;

create policy "chat_bans_select"
  on public.chat_bans for select to anon, authenticated
  using (
    public.is_staff(public.current_email())
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_bans.room_id
        and cr.is_active = true
    )
  );

create policy "chat_bans_insert_staff"
  on public.chat_bans for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "chat_bans_update_staff"
  on public.chat_bans for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "chat_bans_delete_staff"
  on public.chat_bans for delete to authenticated
  using (public.is_staff(public.current_email()));

-- ---------- product_schedules ----------
alter table public.product_schedules enable row level security;

drop policy if exists "Anyone can view product schedules" on public.product_schedules;
drop policy if exists "Authenticated users can insert product schedules" on public.product_schedules;
drop policy if exists "Authenticated users can update product schedules" on public.product_schedules;
drop policy if exists "Authenticated users can delete product schedules" on public.product_schedules;
drop policy if exists "product_schedules_anon_select_customer_visible" on public.product_schedules;
drop policy if exists "product_schedules_select_team" on public.product_schedules;
drop policy if exists "product_schedules_insert_staff" on public.product_schedules;
drop policy if exists "product_schedules_update_staff" on public.product_schedules;
drop policy if exists "product_schedules_delete_staff" on public.product_schedules;

revoke all on table public.product_schedules from anon;
grant select on table public.product_schedules to anon;
grant select, insert, update, delete on table public.product_schedules to authenticated;

create policy "product_schedules_anon_select_customer_visible"
  on public.product_schedules for select to anon
  using (coalesce(show_to_customers, false) = true);

create policy "product_schedules_select_team"
  on public.product_schedules for select to authenticated
  using (public.is_team_member(public.current_email()));

create policy "product_schedules_insert_staff"
  on public.product_schedules for insert to authenticated
  with check (public.is_staff(public.current_email()));

create policy "product_schedules_update_staff"
  on public.product_schedules for update to authenticated
  using (public.is_staff(public.current_email()))
  with check (public.is_staff(public.current_email()));

create policy "product_schedules_delete_staff"
  on public.product_schedules for delete to authenticated
  using (public.is_staff(public.current_email()));

commit;
