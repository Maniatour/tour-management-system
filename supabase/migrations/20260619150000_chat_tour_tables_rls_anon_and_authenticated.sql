-- Step 4 (RLS hardening): tour customer chat — chat_rooms, chat_messages, chat_participants
-- Removes legacy "Enable all access" / is_team_member-only policies that break public(anon) chat
-- or leave effective full access. Public /chat/[code] stays anon+active room; guides use JWT.
-- Depends: public.current_email(), public.is_staff(), public.tour_expense_row_accessible_as_assignee (tours; 20260619140000).

begin;

-- Legacy permissive / team-only (see 20250101000107, 202509180160)
drop policy if exists "Enable all access for chat_rooms" on public.chat_rooms;
drop policy if exists "Enable all access for chat_messages" on public.chat_messages;
drop policy if exists "Enable all access for chat_participants" on public.chat_participants;

drop policy if exists "chat_rooms_select_team" on public.chat_rooms;
drop policy if exists "chat_rooms_insert_team" on public.chat_rooms;
drop policy if exists "chat_rooms_update_team" on public.chat_rooms;

drop policy if exists "chat_messages_select_team" on public.chat_messages;
drop policy if exists "chat_messages_insert_team" on public.chat_messages;
drop policy if exists "chat_messages_update_team" on public.chat_messages;

drop policy if exists "chat_participants_select_team" on public.chat_participants;
drop policy if exists "chat_participants_insert_team" on public.chat_participants;
drop policy if exists "chat_participants_update_team" on public.chat_participants;

alter table public.chat_rooms enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_participants enable row level security;

-- ---------- chat_rooms ----------

-- 고객 공개 링크: 활성 방만 조회 (room_code 로 필터하는 앱 패턴 유지)
create policy "chat_rooms_anon_select_active"
  on public.chat_rooms
  for select
  to anon
  using (is_active = true);

-- POST /api/chat-rooms/create 가 anon 클라이언트로 방 생성 (created_by = system)
create policy "chat_rooms_anon_insert_system_tour"
  on public.chat_rooms
  for insert
  to anon
  with check (
    is_active = true
    and lower(trim(created_by)) = 'system'
    and tour_id is not null
    and exists (select 1 from public.tours t where t.id = tour_id)
  );

create policy "chat_rooms_auth_select"
  on public.chat_rooms
  for select
  to authenticated
  using (
    public.is_staff()
    or (
      is_active = true
      and (
        public.tour_expense_row_accessible_as_assignee(tour_id)
        or lower(trim(created_by)) = public.current_email()
      )
    )
  );

create policy "chat_rooms_auth_insert"
  on public.chat_rooms
  for insert
  to authenticated
  with check (
    public.is_staff()
    or (
      public.tour_expense_row_accessible_as_assignee(tour_id)
      and lower(trim(created_by)) = public.current_email()
    )
  );

create policy "chat_rooms_auth_update"
  on public.chat_rooms
  for update
  to authenticated
  using (
    public.is_staff()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(created_by)) = public.current_email()
  )
  with check (
    public.is_staff()
    or public.tour_expense_row_accessible_as_assignee(tour_id)
    or lower(trim(created_by)) = public.current_email()
  );

create policy "chat_rooms_auth_delete_staff"
  on public.chat_rooms
  for delete
  to authenticated
  using (public.is_staff());

-- ---------- chat_messages ----------

create policy "chat_messages_anon_select_active_room"
  on public.chat_messages
  for select
  to anon
  using (
    exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_messages.room_id
        and cr.is_active = true
    )
  );

-- 고객 전송은 주로 /api/chat-messages(service_role). anon 직접 INSERT 는 허용하지 않음.

create policy "chat_messages_auth_select"
  on public.chat_messages
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_messages.room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  );

create policy "chat_messages_auth_insert"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  );

create policy "chat_messages_auth_update"
  on public.chat_messages
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

create policy "chat_messages_auth_delete_staff"
  on public.chat_messages
  for delete
  to authenticated
  using (public.is_staff());

-- ---------- chat_participants ----------

create policy "chat_participants_anon_select_active_room"
  on public.chat_participants
  for select
  to anon
  using (
    exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_participants.room_id
        and cr.is_active = true
    )
  );

create policy "chat_participants_auth_select"
  on public.chat_participants
  for select
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = chat_participants.room_id
        and cr.is_active = true
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  );

create policy "chat_participants_auth_insert"
  on public.chat_participants
  for insert
  to authenticated
  with check (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  );

create policy "chat_participants_auth_update"
  on public.chat_participants
  for update
  to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  )
  with check (
    public.is_staff()
    or exists (
      select 1
      from public.chat_rooms cr
      where cr.id = room_id
        and (
          public.tour_expense_row_accessible_as_assignee(cr.tour_id)
          or lower(trim(cr.created_by)) = public.current_email()
        )
    )
  );

create policy "chat_participants_auth_delete_staff"
  on public.chat_participants
  for delete
  to authenticated
  using (public.is_staff());

commit;
