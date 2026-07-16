-- Restore guest access for public tour chat (/chat/{room_code}):
-- 1) Fix chat_bans SELECT (anon cannot EXECUTE is_staff(text))
-- 2) Drop overly-permissive public USING(true) SELECT on chat_* (RPC-only for guests)
-- 3) Fix storage policies TO public that query team (breaks anon .list() with permission denied)
-- 4) Allow anon/authenticated to list+upload tour-photos for tours with an active chat room
-- 5) Public RPC for guide/assistant card (anon has no GRANT on team)

begin;

-- =============================================================================
-- Helpers (SECURITY DEFINER so anon policies never touch chat_rooms/team directly)
-- =============================================================================
create or replace function public.chat_room_is_active(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_rooms cr
    where cr.id = p_room_id
      and cr.is_active is true
  );
$$;

create or replace function public.tour_has_active_chat_room(p_tour_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_rooms cr
    where cr.tour_id = nullif(btrim(p_tour_id), '')
      and cr.is_active is true
  );
$$;

-- Public chat: guide/assistant display info without granting team SELECT to anon
create or replace function public.get_public_chat_tour_staff(p_tour_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select tour.tour_guide_id, tour.assistant_id
    from public.tours tour
    where tour.id = nullif(btrim(p_tour_id), '')
      and public.tour_has_active_chat_room(tour.id)
    limit 1
  )
  select jsonb_build_object(
    'guide', (
      select jsonb_build_object(
        'name_ko', tm.name_ko,
        'name_en', tm.name_en,
        'nick_name', tm.nick_name,
        'phone', tm.phone,
        'position', tm.position,
        'languages', tm.languages,
        'email', tm.email
      )
      from t
      join public.team tm on tm.email = t.tour_guide_id
      where t.tour_guide_id is not null
      limit 1
    ),
    'assistant', (
      select jsonb_build_object(
        'name_ko', tm.name_ko,
        'name_en', tm.name_en,
        'nick_name', tm.nick_name,
        'phone', tm.phone,
        'position', tm.position,
        'languages', tm.languages,
        'email', tm.email
      )
      from t
      join public.team tm on tm.email = t.assistant_id
      where t.assistant_id is not null
      limit 1
    )
  );
$$;

revoke all on function public.chat_room_is_active(uuid) from public;
revoke all on function public.tour_has_active_chat_room(text) from public;
revoke all on function public.get_public_chat_tour_staff(text) from public;

grant execute on function public.chat_room_is_active(uuid) to anon, authenticated, service_role;
grant execute on function public.tour_has_active_chat_room(text) to anon, authenticated, service_role;
grant execute on function public.get_public_chat_tour_staff(text) to anon, authenticated, service_role;

-- Ensure guest chat RPCs remain executable after security-advisor revokes
grant execute on function public.get_public_chat_room_bundle_by_code(text) to anon, authenticated, service_role;
grant execute on function public.get_chat_messages_by_room_code(text, integer) to anon, authenticated, service_role;
grant execute on function public.get_chat_message_count_by_room_code(text) to anon, authenticated, service_role;
grant execute on function public.get_chat_participants_by_room_code(text) to anon, authenticated, service_role;

-- =============================================================================
-- chat_bans: split staff vs anon (avoid is_staff(text) for anon)
-- =============================================================================
drop policy if exists "chat_bans_select" on public.chat_bans;
drop policy if exists "chat_bans_select_staff" on public.chat_bans;
drop policy if exists "chat_bans_select_anon_active_room" on public.chat_bans;

create policy "chat_bans_select_staff"
  on public.chat_bans for select to authenticated
  using (public.rls_is_staff_session_ok());

create policy "chat_bans_select_anon_active_room"
  on public.chat_bans for select to anon
  using (public.chat_room_is_active(room_id));

-- =============================================================================
-- Drop legacy public USING(true) SELECT — guests must use room_code RPCs
-- =============================================================================
drop policy if exists "chat_rooms_select_all" on public.chat_rooms;
drop policy if exists "chat_messages_select_all" on public.chat_messages;
drop policy if exists "chat_participants_select_all" on public.chat_participants;

-- =============================================================================
-- push_subscriptions: EXISTS(chat_rooms) fails when anon cannot SELECT chat_rooms
-- =============================================================================
drop policy if exists "push_subscriptions_insert_room" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_room" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_room" on public.push_subscriptions;

create policy "push_subscriptions_insert_room"
  on public.push_subscriptions for insert
  with check (
    room_id is not null
    and public.chat_room_is_active(room_id)
  );

create policy "push_subscriptions_update_room"
  on public.push_subscriptions for update
  using (
    room_id is not null
    and public.chat_room_is_active(room_id)
  )
  with check (
    room_id is not null
    and public.chat_room_is_active(room_id)
  );

create policy "push_subscriptions_delete_room"
  on public.push_subscriptions for delete
  using (
    room_id is not null
    and public.chat_room_is_active(room_id)
  );

-- =============================================================================
-- Storage: policies TO public that query team break ALL anon storage SELECT
-- (Postgres raises "permission denied for table team" instead of false)
-- =============================================================================
drop policy if exists "Admins and managers can manage all guide documents storage" on storage.objects;
create policy "Admins and managers can manage all guide documents storage"
  on storage.objects for all to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'guide-documents'
    and public.rls_is_staff_session_ok()
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'guide-documents'
    and public.rls_is_staff_session_ok()
  );

drop policy if exists "팀원은 문서를 조회할 수 있음" on storage.objects;
create policy "팀원은 문서를 조회할 수 있음"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.rls_team_member_session_ok()
  );

drop policy if exists "팀원은 문서를 업로드할 수 있음" on storage.objects;
create policy "팀원은 문서를 업로드할 수 있음"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.rls_team_member_session_ok()
  );

drop policy if exists "관리자는 모든 문서를 삭제할 수 있음" on storage.objects;
create policy "관리자는 모든 문서를 삭제할 수 있음"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.rls_is_staff_session_ok()
  );

drop policy if exists "팀원은 자신의 문서를 삭제할 수 있음" on storage.objects;
create policy "팀원은 자신의 문서를 삭제할 수 있음"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.rls_team_member_session_ok()
    and (storage.foldername(name))[2] = coalesce(auth.jwt() ->> 'email', '')
  );

-- document-files / uploads: public SELECT policies that touch privileged tables
-- also break anon storage listing for unrelated buckets (tour-photos).
drop policy if exists "Users can view their own documents" on storage.objects;
create policy "Users can view their own documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'document-files'
    and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or exists (
        select 1
        from public.documents d
        where d.file_path = objects.name
          and (
            d.created_by = auth.uid()
            or exists (
              select 1
              from public.document_permissions dp
              where dp.document_id = d.id
                and dp.user_id = auth.uid()
                and (dp.permission_type)::text = any (array['view'::text, 'edit'::text, 'delete'::text])
            )
          )
      )
    )
  );

drop policy if exists "Guides can view their documents" on storage.objects;
create policy "Guides can view their documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = 'guide-documents'
  );

drop policy if exists "Allow authenticated users to view customer documents" on storage.objects;
create policy "Allow authenticated users to view customer documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'customer-documents');

drop policy if exists "Allow all authenticated users" on storage.objects;
create policy "Allow all authenticated users"
  on storage.objects for all to authenticated
  using (true)
  with check (true);

-- =============================================================================
-- tour-photos: guest gallery list + upload for active tour chat rooms
-- =============================================================================
drop policy if exists "tour_photos_anon_select_active_chat" on storage.objects;
drop policy if exists "tour_photos_anon_insert_active_chat" on storage.objects;
drop policy if exists "tour_photos_anon_update_active_chat" on storage.objects;

create policy "tour_photos_anon_select_active_chat"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'tour-photos'
    and public.tour_has_active_chat_room((storage.foldername(name))[1])
  );

create policy "tour_photos_anon_insert_active_chat"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'tour-photos'
    and public.tour_has_active_chat_room((storage.foldername(name))[1])
  );

-- Upsert/replace during upload needs UPDATE
create policy "tour_photos_anon_update_active_chat"
  on storage.objects for update to anon, authenticated
  using (
    bucket_id = 'tour-photos'
    and public.tour_has_active_chat_room((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'tour-photos'
    and public.tour_has_active_chat_room((storage.foldername(name))[1])
  );

comment on function public.chat_room_is_active(uuid) is
  'Guest chat helper: true when chat_rooms row exists and is_active.';
comment on function public.tour_has_active_chat_room(text) is
  'Guest chat/photos helper: true when tour has an active chat room.';
comment on function public.get_public_chat_tour_staff(text) is
  'Public tour chat: guide/assistant display fields for active-chat tours only.';

commit;
