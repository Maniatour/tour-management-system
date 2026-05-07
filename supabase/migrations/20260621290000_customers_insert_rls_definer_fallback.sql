-- customers INSERT: is_staff / is_team_member 가 INVOKER·team RLS 조합으로 약해진 배포에서
-- 사무실 등 활성 team 행이 있어도 42501 이 나는 경우를 줄인다.
-- auth.uid() → auth.users.email 및 JWT email/user_metadata 로 team 을 직접 매칭 (DEFINER + row_security=off).

begin;

create or replace function public.customers_insert_policy_ok()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    lower(trim(coalesce(
      (select u.email::text from auth.users u where u.id = auth.uid() limit 1),
      ''
    ))) in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
    or lower(trim(coalesce(auth.jwt() ->> 'email', ''))) in ('info@maniatour.com', 'wooyong.shim09@gmail.com')
    or lower(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', ''))) in (
      'info@maniatour.com',
      'wooyong.shim09@gmail.com'
    )
    or exists (
      select 1
      from public.team t
      where coalesce(t.is_active, true) = true
        and length(trim(coalesce(t.email, ''))) > 0
        and auth.uid() is not null
        and lower(trim(t.email)) = (
          select lower(trim(coalesce(u.email::text, '')))
          from auth.users u
          where u.id = auth.uid()
          limit 1
        )
        and length(trim(coalesce(
          (select u.email::text from auth.users u where u.id = auth.uid() limit 1),
          ''
        ))) > 0
    )
    or exists (
      select 1
      from public.team t
      where coalesce(t.is_active, true) = true
        and length(trim(coalesce(t.email, ''))) > 0
        and (
          (
            length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 0
            and lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
          )
          or (
            length(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', ''))) > 0
            and lower(trim(t.email)) = lower(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', '')))
          )
        )
    );
$$;

comment on function public.customers_insert_policy_ok() is
  'customers INSERT RLS: auth.users·JWT 이메일이 활성 team 과 일치하면 true (DEFINER).';

grant execute on function public.customers_insert_policy_ok() to authenticated;

-- 직책 문자열이 로컬라이즈된 사무·예약 역할인 경우 (team 행은 있으나 이전 화이트리스트만 통과하던 배포용)
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
        'office staff',
        'office',
        '매니저',
        'admin',
        '사무',
        '사무실',
        '예약',
        '예약실',
        'reservation',
        'cs',
        'counter',
        'desk',
        'reception'
      )
      and length(trim(coalesce(p_email, ''))) > 0
      and lower(trim(t.email)) = lower(trim(coalesce(p_email, '')))
  );
$$;

drop policy if exists "customers_insert_accessible" on public.customers;

create policy "customers_insert_accessible"
  on public.customers for insert to authenticated
  with check (
    public.rls_is_staff_session_ok()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
    or public.customer_insert_team_role_ok()
    or public.customers_insert_policy_ok()
  );

commit;
