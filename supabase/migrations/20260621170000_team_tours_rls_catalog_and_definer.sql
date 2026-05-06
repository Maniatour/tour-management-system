-- Step: team(직원 디렉터리) anon 차단·인증 팀만 SELECT, tours(공개 예약용 anon 카탈로그 + 팀/가이드)
-- tours 정책에서 tour_expense_row_accessible_as_assignee(tours)처럼 같은 테이블을 INVOKER로 읽으면 RLS 재귀 위험이 있어
-- SECURITY DEFINER 헬퍼로 행 단위 판별 (211600 session_email_from_auth_users 등에 의존).
--
-- Depends: public.is_staff(), public.is_staff_for_session(), public.is_team_member(text),
--   public.is_team_member_for_session(), public.current_email(), public.normalize_email_list(text),
--   public.session_email_from_auth_users() (20260621160000).

begin;

-- ---------- tours: RLS용 행 접근 (DEFINER로 tours RLS 재귀 방지) ----------
create or replace function public.tour_row_visible_for_policy(p_tour_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_tour_id is not null
  and exists (
    select 1
    from public.tours t
    where t.id = p_tour_id
      and (
        public.is_staff()
        or public.is_staff_for_session()
        or public.is_team_member(public.current_email())
        or public.is_team_member_for_session()
        or public.current_email() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
        or public.current_email() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
        or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.tour_guide_id, '')))
        or public.session_email_from_auth_users() = any (public.normalize_email_list(coalesce(t.assistant_id, '')))
      )
  );
$$;

comment on function public.tour_row_visible_for_policy(text) is
  'tours RLS: 스태프·팀·가이드/어시 배정 행 노출 (DEFINER, tours 자기참조 RLS 재귀 방지).';

-- ---------- team ----------
alter table public.team enable row level security;

drop policy if exists "team_select_all" on public.team;
drop policy if exists "team_modify_staff_only" on public.team;
drop policy if exists "team_insert_staff" on public.team;
drop policy if exists "team_update_staff" on public.team;
drop policy if exists "team_delete_staff" on public.team;
drop policy if exists "team_select_authenticated" on public.team;

revoke all on table public.team from anon;

grant select, insert, update, delete on table public.team to authenticated;

create policy "team_select_authenticated"
  on public.team for select to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  );

create policy "team_insert_staff"
  on public.team for insert to authenticated
  with check (public.is_staff() or public.is_staff_for_session());

create policy "team_update_staff"
  on public.team for update to authenticated
  using (public.is_staff() or public.is_staff_for_session())
  with check (public.is_staff() or public.is_staff_for_session());

create policy "team_delete_staff"
  on public.team for delete to authenticated
  using (public.is_staff() or public.is_staff_for_session());

-- ---------- tours ----------
alter table public.tours enable row level security;

drop policy if exists "tours_select_all" on public.tours;
drop policy if exists "tours_select_assigned_or_staff" on public.tours;
drop policy if exists "tours_modify_staff_only" on public.tours;
drop policy if exists "tours_insert_staff" on public.tours;
drop policy if exists "tours_update_staff" on public.tours;
drop policy if exists "tours_delete_staff" on public.tours;
drop policy if exists "tours_select_anon_catalog" on public.tours;
drop policy if exists "tours_select_authenticated" on public.tours;
drop policy if exists "tours_insert_team_or_staff" on public.tours;
drop policy if exists "tours_update_accessible" on public.tours;
drop policy if exists "tours_delete_team_or_staff" on public.tours;
drop policy if exists "tours_delete_staff" on public.tours;

revoke all on table public.tours from anon;
grant select on table public.tours to anon;

grant select, insert, update, delete on table public.tours to authenticated;

create policy "tours_select_anon_catalog"
  on public.tours for select to anon
  using (
    product_id is not null
    and exists (
      select 1
      from public.products p
      where p.id = tours.product_id
        and lower(trim(coalesce(p.status::text, ''))) = 'active'
    )
  );

create policy "tours_select_authenticated"
  on public.tours for select to authenticated
  using (public.tour_row_visible_for_policy(id));

create policy "tours_insert_team_or_staff"
  on public.tours for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
  );

create policy "tours_update_accessible"
  on public.tours for update to authenticated
  using (public.tour_row_visible_for_policy(id))
  with check (public.tour_row_visible_for_policy(id));

create policy "tours_delete_staff"
  on public.tours for delete to authenticated
  using (public.is_staff() or public.is_staff_for_session());

commit;
