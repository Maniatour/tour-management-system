-- customers INSERT: is_staff() 정의가 직책 화이트리스트만 허용하거나 office_manager(언더스코어) 등이
-- 빠진 배포에서 office_manager / op 가 RLS 로 막히는 문제를 방지한다.
-- team 은 SECURITY DEFINER + row_security=off 로만 읽는다.
--
-- Depends: current_email, session_email_from_auth_users, rls_is_staff_session_ok (20260621260000),
--          is_team_member* (20260621240000 등).

begin;

create or replace function public.customer_insert_team_role_ok(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.team t
    where coalesce(t.is_active, true) = true
      and lower(trim(coalesce(t.position::text, ''))) in (
        'op',
        'super',
        'manager',
        'office manager',
        'office_manager',
        '매니저',
        'admin'
      )
      and length(trim(coalesce(p_email, ''))) > 0
      and lower(trim(t.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;

comment on function public.customer_insert_team_role_ok(text) is
  'customers INSERT 권한: 해당 이메일이 op·super·manager·office manager·office_manager·매니저·admin 활성 팀원인지 (DEFINER).';

create or replace function public.customer_insert_team_role_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select (
    length(trim(coalesce(public.current_email(), ''))) > 0
    and public.customer_insert_team_role_ok(public.current_email())
  )
  or (
    length(trim(coalesce(public.session_email_from_auth_users(), ''))) > 0
    and public.customer_insert_team_role_ok(public.session_email_from_auth_users())
  );
$$;

comment on function public.customer_insert_team_role_ok() is
  'customers INSERT RLS: current_email 또는 세션 auth.users 이메일 기준 customer_insert_team_role_ok(text).';

drop policy if exists "customers_insert_accessible" on public.customers;

create policy "customers_insert_accessible"
  on public.customers for insert to authenticated
  with check (
    public.rls_is_staff_session_ok()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
    or public.customer_insert_team_role_ok()
  );

commit;
