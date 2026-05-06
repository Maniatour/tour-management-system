-- Team board RLS: auth.jwt() ->> 'email' 단일 경로 제거 (시뮬레이션·auth.users 폴백과 정합)
-- issues: assigned_to 컬럼 제거(202509180200) 이후에도 정책이 참조하던 문제 정리 — 팀 전체 조회(가이드 보드) 유지
-- Depends: current_email(), session_email_from_auth_users(), is_team_member*, is_admin_user*, can_manage_data*, is_team_member_for_session, is_admin_user_for_session (211600 등)

begin;

-- ---------- helpers (INVOKER) ----------
create or replace function public.team_board_request_is_member()
returns boolean
language sql
stable
set search_path = public
as $$
  select (
    length(public.current_email()) > 0
    and public.is_team_member(public.current_email())
  )
  or (
    length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
    and public.is_team_member(public.session_email_from_auth_users())
  )
  or public.is_team_member_for_session();
$$;

comment on function public.team_board_request_is_member() is
  '팀 보드 RLS: JWT·auth.users 기반 팀 멤버 여부.';

create or replace function public.team_board_email_matches(p_email text)
returns boolean
language sql
stable
set search_path = public
as $$
  select (
    length(public.current_email()) > 0
    and public.current_email() = lower(trim(coalesce(p_email, '')))
  )
  or (
    length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
    and public.session_email_from_auth_users() = lower(trim(coalesce(p_email, '')))
  );
$$;

comment on function public.team_board_email_matches(text) is
  '컬럼 이메일이 current_email 또는 세션 auth.users 이메일과 일치하는지.';

create or replace function public.team_board_is_admin_session()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_admin_user(public.current_email())
    or public.is_admin_user(public.session_email_from_auth_users())
    or public.is_admin_user_for_session();
$$;

create or replace function public.team_board_can_manage_data_session()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.can_manage_data(public.current_email())
    or public.can_manage_data(public.session_email_from_auth_users());
$$;

-- ---------- tasks ----------
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;

create policy "tasks_select" on public.tasks
  for select using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        assigned_to is not null
        and public.team_board_email_matches(assigned_to)
      )
      or public.team_board_is_admin_session()
    )
  );

create policy "tasks_insert" on public.tasks
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(created_by)
  );

create policy "tasks_update" on public.tasks
  for update using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        assigned_to is not null
        and public.team_board_email_matches(assigned_to)
      )
      or public.team_board_is_admin_session()
    )
  )
  with check (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        assigned_to is not null
        and public.team_board_email_matches(assigned_to)
      )
      or public.team_board_is_admin_session()
    )
  );

create policy "tasks_delete" on public.tasks
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- issues (assigned_to 제거 반영) ----------
drop policy if exists "issues_select" on public.issues;
drop policy if exists "issues_insert" on public.issues;
drop policy if exists "issues_update" on public.issues;
drop policy if exists "issues_delete" on public.issues;

create policy "issues_select" on public.issues
  for select using (public.team_board_request_is_member());

create policy "issues_insert" on public.issues
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_can_manage_data_session()
    and public.team_board_email_matches(reported_by)
  );

create policy "issues_update" on public.issues
  for update using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(reported_by)
      or public.team_board_is_admin_session()
    )
  )
  with check (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(reported_by)
      or public.team_board_is_admin_session()
    )
  );

create policy "issues_delete" on public.issues
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(reported_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- team_board_comments / team_board_status_logs ----------
-- 일부 DB에는 20260323123000 / 20260323143000 미적용으로 테이블이 없을 수 있음.
do $team_board_optional$
begin
  if to_regclass('public.team_board_comments') is not null then
    drop policy if exists "team_board_comments_select" on public.team_board_comments;
    drop policy if exists "team_board_comments_insert" on public.team_board_comments;
    drop policy if exists "team_board_comments_delete" on public.team_board_comments;

    create policy "team_board_comments_select" on public.team_board_comments
      for select using (public.team_board_request_is_member());

    create policy "team_board_comments_insert" on public.team_board_comments
      for insert with check (
        public.team_board_request_is_member()
        and public.team_board_email_matches(created_by)
      );

    create policy "team_board_comments_delete" on public.team_board_comments
      for delete using (
        public.team_board_request_is_member()
        and (
          public.team_board_email_matches(created_by)
          or public.team_board_is_admin_session()
        )
      );
  end if;

  if to_regclass('public.team_board_status_logs') is not null then
    drop policy if exists "team_board_status_logs_select" on public.team_board_status_logs;
    drop policy if exists "team_board_status_logs_insert" on public.team_board_status_logs;

    create policy "team_board_status_logs_select" on public.team_board_status_logs
      for select using (public.team_board_request_is_member());

    create policy "team_board_status_logs_insert" on public.team_board_status_logs
      for insert with check (
        public.team_board_request_is_member()
        and public.team_board_email_matches(changed_by)
      );
  end if;
end
$team_board_optional$;

-- ---------- op_todos ----------
drop policy if exists "op_todos_select" on public.op_todos;
drop policy if exists "op_todos_insert" on public.op_todos;
drop policy if exists "op_todos_update" on public.op_todos;
drop policy if exists "op_todos_delete" on public.op_todos;

create policy "op_todos_select" on public.op_todos
  for select using (public.team_board_request_is_member());

create policy "op_todos_insert" on public.op_todos
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(created_by)
  );

create policy "op_todos_update" on public.op_todos
  for update using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        assigned_to is not null
        and public.team_board_email_matches(assigned_to)
      )
      or public.team_board_is_admin_session()
    )
  )
  with check (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        assigned_to is not null
        and public.team_board_email_matches(assigned_to)
      )
      or public.team_board_is_admin_session()
    )
  );

create policy "op_todos_delete" on public.op_todos
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- team_announcements ----------
drop policy if exists "team_announcements_select" on public.team_announcements;
drop policy if exists "team_announcements_insert" on public.team_announcements;
drop policy if exists "team_announcements_update" on public.team_announcements;
drop policy if exists "team_announcements_delete" on public.team_announcements;

create policy "team_announcements_select" on public.team_announcements
  for select using (public.team_board_request_is_member());

create policy "team_announcements_insert" on public.team_announcements
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(created_by)
  );

create policy "team_announcements_update" on public.team_announcements
  for update using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  )
  with check (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

create policy "team_announcements_delete" on public.team_announcements
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- team_announcement_comments ----------
drop policy if exists "team_announcement_comments_select" on public.team_announcement_comments;
drop policy if exists "team_announcement_comments_insert" on public.team_announcement_comments;
drop policy if exists "team_announcement_comments_delete" on public.team_announcement_comments;

create policy "team_announcement_comments_select" on public.team_announcement_comments
  for select using (public.team_board_request_is_member());

create policy "team_announcement_comments_insert" on public.team_announcement_comments
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(created_by)
  );

create policy "team_announcement_comments_delete" on public.team_announcement_comments
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- team_announcement_acknowledgments ----------
drop policy if exists "team_announcement_acks_select" on public.team_announcement_acknowledgments;
drop policy if exists "team_announcement_acks_insert" on public.team_announcement_acknowledgments;
drop policy if exists "team_announcement_acks_delete" on public.team_announcement_acknowledgments;

create policy "team_announcement_acks_select" on public.team_announcement_acknowledgments
  for select using (public.team_board_request_is_member());

create policy "team_announcement_acks_insert" on public.team_announcement_acknowledgments
  for insert with check (
    public.team_board_request_is_member()
    and public.team_board_email_matches(ack_by)
  );

create policy "team_announcement_acks_delete" on public.team_announcement_acknowledgments
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(ack_by)
      or public.team_board_is_admin_session()
    )
  );

-- ---------- projects (레거시; RLS 정합) ----------
drop policy if exists "projects_select" on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;

create policy "projects_select" on public.projects
  for select using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        length(public.current_email()) > 0
        and assigned_to is not null
        and assigned_to @> array[public.current_email()]::text[]
      )
      or (
        length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
        and assigned_to is not null
        and assigned_to @> array[public.session_email_from_auth_users()]::text[]
      )
      or public.team_board_is_admin_session()
    )
  );

create policy "projects_insert" on public.projects
  for insert with check (
    public.team_board_can_manage_data_session()
    and public.team_board_email_matches(created_by)
  );

create policy "projects_update" on public.projects
  for update using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        length(public.current_email()) > 0
        and assigned_to is not null
        and assigned_to @> array[public.current_email()]::text[]
      )
      or (
        length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
        and assigned_to is not null
        and assigned_to @> array[public.session_email_from_auth_users()]::text[]
      )
      or public.team_board_is_admin_session()
    )
  )
  with check (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or (
        length(public.current_email()) > 0
        and assigned_to is not null
        and assigned_to @> array[public.current_email()]::text[]
      )
      or (
        length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
        and assigned_to is not null
        and assigned_to @> array[public.session_email_from_auth_users()]::text[]
      )
      or public.team_board_is_admin_session()
    )
  );

create policy "projects_delete" on public.projects
  for delete using (
    public.team_board_request_is_member()
    and (
      public.team_board_email_matches(created_by)
      or public.team_board_is_admin_session()
    )
  );

commit;
