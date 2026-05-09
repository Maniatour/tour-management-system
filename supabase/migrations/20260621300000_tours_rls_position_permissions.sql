-- tours RLS: team.position 기준으로 투어 생성/수정/조회 권한을 명확히 정렬한다.
-- op, manager, office_manager, super 는 INSERT/UPDATE/SELECT 가능.
-- op, manager, office_manager 는 물리 DELETE 없이 tour_status='Deleted' 업데이트로만 soft delete 가능.

begin;

create or replace function public.tours_team_position_ok(p_positions text[])
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with actor_emails as (
    select lower(trim(email)) as email
    from (
      select auth.jwt() ->> 'email' as email
      union all
      select auth.jwt() -> 'user_metadata' ->> 'email'
      union all
      select (
        select u.email::text
        from auth.users u
        where u.id = auth.uid()
        limit 1
      )
    ) e
    where length(trim(coalesce(email, ''))) > 0
  )
  select exists (
    select 1
    from public.team t
    where coalesce(t.is_active, true) = true
      and lower(trim(coalesce(t.position::text, ''))) = any (p_positions)
      and lower(trim(coalesce(t.email, ''))) in (select email from actor_emails)
  );
$$;

comment on function public.tours_team_position_ok(text[]) is
  'tours RLS: JWT/auth.users 이메일이 활성 team 행과 매칭되고 position 이 허용 목록에 있으면 true.';

create or replace function public.tours_actor_emails()
returns text[]
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce(array_agg(distinct lower(trim(email))), array[]::text[])
  from (
    select auth.jwt() ->> 'email' as email
    union all
    select auth.jwt() -> 'user_metadata' ->> 'email'
    union all
    select (
      select u.email::text
      from auth.users u
      where u.id = auth.uid()
      limit 1
    )
  ) e
  where length(trim(coalesce(email, ''))) > 0;
$$;

comment on function public.tours_actor_emails() is
  'tours RLS: JWT/auth.users 에서 현재 로그인 actor 이메일 후보 목록.';

create or replace function public.tours_normalize_email_list(p_emails text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct email), array[]::text[])
  from (
    select lower(trim(part)) as email
    from regexp_split_to_table(
      regexp_replace(coalesce(p_emails, ''), '[\[\]"{}]', '', 'g'),
      '\s*[,;]\s*'
    ) as part
  ) s
  where length(email) > 0;
$$;

comment on function public.tours_normalize_email_list(text) is
  'tours RLS: tour_guide_id/assistant_id 이메일 문자열을 소문자 배열로 정규화.';

create or replace function public.tours_assigned_actor_ok(
  p_tour_guide_id text,
  p_assistant_id text
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from unnest(public.tours_actor_emails()) as actor(email)
    where actor.email = any (public.tours_normalize_email_list(p_tour_guide_id))
       or actor.email = any (public.tours_normalize_email_list(p_assistant_id))
  );
$$;

comment on function public.tours_assigned_actor_ok(text, text) is
  'tours RLS: 현재 로그인 이메일이 tour_guide_id 또는 assistant_id 에 배정되어 있으면 true.';

create or replace function public.tours_write_position_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.tours_team_position_ok(array[
    'op',
    'manager',
    'office_manager',
    'office manager',
    'super'
  ]);
$$;

comment on function public.tours_write_position_ok() is
  'tours RLS: op, manager, office_manager/office manager, super 생성·수정·조회 허용.';

create or replace function public.tours_hard_delete_position_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select public.tours_team_position_ok(array['super']);
$$;

comment on function public.tours_hard_delete_position_ok() is
  'tours RLS: 물리 DELETE 는 super position 만 허용. 그 외 운영 직책은 UPDATE 기반 soft delete 만 허용.';

grant execute on function public.tours_team_position_ok(text[]) to authenticated;
grant execute on function public.tours_actor_emails() to authenticated;
grant execute on function public.tours_normalize_email_list(text) to authenticated;
grant execute on function public.tours_assigned_actor_ok(text, text) to authenticated;
grant execute on function public.tours_write_position_ok() to authenticated;
grant execute on function public.tours_hard_delete_position_ok() to authenticated;

alter table public.tours enable row level security;

drop policy if exists "tours_select_authenticated" on public.tours;
drop policy if exists "tours_insert_team_or_staff" on public.tours;
drop policy if exists "tours_update_accessible" on public.tours;
drop policy if exists "tours_delete_staff" on public.tours;

create policy "tours_select_authenticated"
  on public.tours for select to authenticated
  using (
    public.tours_write_position_ok()
    or public.tours_assigned_actor_ok(tour_guide_id, assistant_id)
  );

create policy "tours_insert_team_or_staff"
  on public.tours for insert to authenticated
  with check (public.tours_write_position_ok());

create policy "tours_update_accessible"
  on public.tours for update to authenticated
  using (public.tours_write_position_ok())
  with check (public.tours_write_position_ok());

create policy "tours_delete_staff"
  on public.tours for delete to authenticated
  using (public.tours_hard_delete_position_ok());

commit;
