-- RLS security audit (2026-07-13)
-- Fixes tables where RLS was disabled in dev/test migrations but never re-enabled,
-- tightens overly permissive policies, and enables RLS on tables missing it.
--
-- Depends: rls_is_staff_session_ok, rls_is_staff_current_session_ok,
--          rls_team_member_session_ok, rls_admin_session_ok,
--          rls_email_eq_session_or_current, team_board_request_is_member (202606212000+).

begin;

-- ---------- Helper: team chat room managers (super / op / office manager) ----------
create or replace function public.team_chat_can_manage_rooms()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.rls_admin_session_ok()
    or exists (
      select 1
      from public.team t
      where coalesce(t.is_active, true) = true
        and lower(trim(coalesce(t.position::text, ''))) in ('super', 'op', 'office manager')
        and (
          lower(trim(t.email)) = public.current_email()
          or lower(trim(t.email)) = public.session_email_from_auth_users()
        )
    );
$$;

comment on function public.team_chat_can_manage_rooms() is
  'RLS: 팀 채팅방 생성·참여자 관리 — super/op/office manager (JWT·세션).';

-- ---------- 1) team_chat_* — RLS was DISABLED in 202501200007 ----------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'team_chat_rooms'
  ) then
    return;
  end if;

  alter table public.team_chat_rooms enable row level security;
  alter table public.team_chat_messages enable row level security;
  alter table public.team_chat_participants enable row level security;
  alter table public.team_chat_read_status enable row level security;

  revoke all on table public.team_chat_rooms from anon;
  revoke all on table public.team_chat_messages from anon;
  revoke all on table public.team_chat_participants from anon;
  revoke all on table public.team_chat_read_status from anon;

  grant select, insert, update, delete on table public.team_chat_rooms to authenticated;
  grant select, insert, update, delete on table public.team_chat_messages to authenticated;
  grant select, insert, update, delete on table public.team_chat_participants to authenticated;
  grant select, insert, update, delete on table public.team_chat_read_status to authenticated;
end$$;

drop policy if exists "team_chat_rooms_select_member" on public.team_chat_rooms;
drop policy if exists "team_chat_rooms_insert_manager" on public.team_chat_rooms;
drop policy if exists "team_chat_rooms_update_manager" on public.team_chat_rooms;
drop policy if exists "팀원은 활성 채팅방을 조회할 수 있음" on public.team_chat_rooms;
drop policy if exists "관리자는 채팅방을 생성할 수 있음" on public.team_chat_rooms;
drop policy if exists "생성자 또는 관리자는 채팅방을 수정할 수 있음" on public.team_chat_rooms;

create policy "team_chat_rooms_select_member"
  on public.team_chat_rooms for select to authenticated
  using (public.rls_team_member_session_ok());

create policy "team_chat_rooms_insert_manager"
  on public.team_chat_rooms for insert to authenticated
  with check (public.team_chat_can_manage_rooms());

create policy "team_chat_rooms_update_manager"
  on public.team_chat_rooms for update to authenticated
  using (
    public.team_chat_can_manage_rooms()
    or public.rls_email_eq_session_or_current(created_by)
  )
  with check (
    public.team_chat_can_manage_rooms()
    or public.rls_email_eq_session_or_current(created_by)
  );

drop policy if exists "team_chat_messages_select_participant" on public.team_chat_messages;
drop policy if exists "team_chat_messages_insert_participant" on public.team_chat_messages;
drop policy if exists "참여자는 메시지를 조회할 수 있음" on public.team_chat_messages;
drop policy if exists "참여자는 메시지를 생성할 수 있음" on public.team_chat_messages;

create policy "team_chat_messages_select_participant"
  on public.team_chat_messages for select to authenticated
  using (
    exists (
      select 1
      from public.team_chat_participants tcp
      inner join public.team t on lower(trim(t.email)) = lower(trim(tcp.participant_email))
      where tcp.room_id = team_chat_messages.room_id
        and tcp.is_active = true
        and coalesce(t.is_active, true) = true
        and public.rls_email_eq_session_or_current(tcp.participant_email)
    )
  );

create policy "team_chat_messages_insert_participant"
  on public.team_chat_messages for insert to authenticated
  with check (
    exists (
      select 1
      from public.team_chat_participants tcp
      inner join public.team t on lower(trim(t.email)) = lower(trim(tcp.participant_email))
      where tcp.room_id = team_chat_messages.room_id
        and tcp.is_active = true
        and coalesce(t.is_active, true) = true
        and public.rls_email_eq_session_or_current(tcp.participant_email)
    )
  );

drop policy if exists "team_chat_participants_select_member" on public.team_chat_participants;
drop policy if exists "team_chat_participants_manage_manager" on public.team_chat_participants;
drop policy if exists "팀원은 참여자 정보를 조회할 수 있음" on public.team_chat_participants;
drop policy if exists "관리자는 참여자를 관리할 수 있음" on public.team_chat_participants;

create policy "team_chat_participants_select_member"
  on public.team_chat_participants for select to authenticated
  using (public.rls_team_member_session_ok());

create policy "team_chat_participants_manage_manager"
  on public.team_chat_participants for all to authenticated
  using (public.team_chat_can_manage_rooms())
  with check (public.team_chat_can_manage_rooms());

drop policy if exists "team_chat_read_status_own" on public.team_chat_read_status;
drop policy if exists "사용자는 자신의 읽음 상태를 관리할 수 있음" on public.team_chat_read_status;

create policy "team_chat_read_status_own"
  on public.team_chat_read_status for all to authenticated
  using (public.rls_email_eq_session_or_current(reader_email))
  with check (public.rls_email_eq_session_or_current(reader_email));

-- ---------- 2) op_todos — RLS DISABLED in 202509180170 (policies exist from 202606212000) ----------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'op_todos'
  ) then
    alter table public.op_todos enable row level security;
    revoke all on table public.op_todos from anon;
    grant select, insert, update, delete on table public.op_todos to authenticated;
  end if;
end$$;

-- ---------- 3) product_details — RLS DISABLED in 20250101000119 ----------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_details'
  ) then
    return;
  end if;

  alter table public.product_details enable row level security;

  revoke all on table public.product_details from anon;
  grant select on table public.product_details to anon;
  grant select, insert, update, delete on table public.product_details to authenticated;
end$$;

drop policy if exists "product_details_staff_all" on public.product_details;
drop policy if exists "product_details_team_all" on public.product_details;
drop policy if exists "product_details_anon_read" on public.product_details;
drop policy if exists "product_details_select_all" on public.product_details;
drop policy if exists "product_details_modify_staff_only" on public.product_details;
drop policy if exists "Allow all operations on product_details for authenticated users" on public.product_details;
drop policy if exists "Allow public read access to product_details" on public.product_details;

create policy "product_details_anon_read"
  on public.product_details for select to anon
  using (true);

create policy "product_details_select_authenticated_active"
  on public.product_details for select to authenticated
  using (
    public.rls_team_member_session_ok()
    or exists (
      select 1
      from public.products p
      where p.id = product_details.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
  );

create policy "product_details_insert_staff"
  on public.product_details for insert to authenticated
  with check (public.rls_is_staff_current_session_ok());

create policy "product_details_update_staff"
  on public.product_details for update to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

create policy "product_details_delete_staff"
  on public.product_details for delete to authenticated
  using (public.rls_is_staff_current_session_ok());

-- ---------- 4) product_details_common — tighten authenticated FOR ALL (true) ----------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'product_details_common'
  ) then
    alter table public.product_details_common enable row level security;
    revoke all on table public.product_details_common from anon;
    grant select, insert, update, delete on table public.product_details_common to authenticated;
  end if;
end$$;

drop policy if exists "Allow all operations on product_details_common for authenticated users"
  on public.product_details_common;
drop policy if exists "product_details_common_team_all" on public.product_details_common;

create policy "product_details_common_select_team"
  on public.product_details_common for select to authenticated
  using (public.rls_team_member_session_ok());

create policy "product_details_common_insert_staff"
  on public.product_details_common for insert to authenticated
  with check (public.rls_is_staff_current_session_ok());

create policy "product_details_common_update_staff"
  on public.product_details_common for update to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

create policy "product_details_common_delete_staff"
  on public.product_details_common for delete to authenticated
  using (public.rls_is_staff_current_session_ok());

-- ---------- 5) document_templates — RLS DISABLED + anon GRANT in 20250120000001 ----------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'document_templates'
  ) then
    return;
  end if;

  alter table public.document_templates enable row level security;
  revoke all on table public.document_templates from anon;
  grant select, insert, update, delete on table public.document_templates to authenticated;
end$$;

drop policy if exists "document_templates_select_team" on public.document_templates;
drop policy if exists "document_templates_write_staff" on public.document_templates;

create policy "document_templates_select_team"
  on public.document_templates for select to authenticated
  using (public.rls_team_member_session_ok());

create policy "document_templates_write_staff"
  on public.document_templates for all to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

-- ---------- 6) product_recommendations — any authenticated could manage ----------
drop policy if exists "Authenticated users can manage product recommendations"
  on public.product_recommendations;
drop policy if exists "Public can read active product recommendations"
  on public.product_recommendations;

create policy "product_recommendations_select_active"
  on public.product_recommendations for select
  using (is_active = true);

create policy "product_recommendations_insert_staff"
  on public.product_recommendations for insert to authenticated
  with check (public.rls_is_staff_current_session_ok());

create policy "product_recommendations_update_staff"
  on public.product_recommendations for update to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

create policy "product_recommendations_delete_staff"
  on public.product_recommendations for delete to authenticated
  using (public.rls_is_staff_current_session_ok());

-- ---------- 7) office schedule — any authenticated could read all slots ----------
drop policy if exists "office_schedule_slots_select_all" on public.office_schedule_slots;
create policy "office_schedule_slots_select_team"
  on public.office_schedule_slots for select to authenticated
  using (public.team_board_request_is_member());

drop policy if exists "office_schedule_slots_modify_staff" on public.office_schedule_slots;
create policy "office_schedule_slots_modify_staff"
  on public.office_schedule_slots for all to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

drop policy if exists "office_schedule_off_days_select_all" on public.office_schedule_off_days;
create policy "office_schedule_off_days_select_team"
  on public.office_schedule_off_days for select to authenticated
  using (public.team_board_request_is_member());

drop policy if exists "office_schedule_off_days_modify_staff" on public.office_schedule_off_days;
create policy "office_schedule_off_days_modify_staff"
  on public.office_schedule_off_days for all to authenticated
  using (public.rls_is_staff_current_session_ok())
  with check (public.rls_is_staff_current_session_ok());

-- ---------- 8) travel_guide_articles — session fallback for staff ----------
drop policy if exists "travel_guide_articles_staff_select" on public.travel_guide_articles;
drop policy if exists "travel_guide_articles_staff_insert" on public.travel_guide_articles;
drop policy if exists "travel_guide_articles_staff_update" on public.travel_guide_articles;
drop policy if exists "travel_guide_articles_staff_delete" on public.travel_guide_articles;

create policy "travel_guide_articles_staff_select"
  on public.travel_guide_articles for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "travel_guide_articles_staff_insert"
  on public.travel_guide_articles for insert to authenticated
  with check (public.rls_is_staff_session_ok());

create policy "travel_guide_articles_staff_update"
  on public.travel_guide_articles for update to authenticated
  using (public.rls_is_staff_session_ok())
  with check (public.rls_is_staff_session_ok());

create policy "travel_guide_articles_staff_delete"
  on public.travel_guide_articles for delete to authenticated
  using (public.rls_is_staff_session_ok());

-- ---------- 9) Enable RLS on tables that have policies but RLS was left disabled ----------
do $$
declare
  r record;
begin
  for r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
      and exists (
        select 1
        from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
      )
  loop
    execute format('alter table public.%I enable row level security', r.table_name);
    raise notice 'RLS enabled on public.% (policies existed but RLS was off)', r.table_name;
  end loop;
end$$;

commit;
