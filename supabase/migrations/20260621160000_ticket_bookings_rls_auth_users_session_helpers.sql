-- ticket_bookings INSERT 42501: current_email() 이 '' 인 환경에서 is_staff()/제출자 일치 분기가 전부 실패할 수 있다.
-- auth.users(auth.uid()) 기반 SECURITY DEFINER 헬퍼로 동일 조건을 복제한다 (JWT claim 의존 감소).
--
-- 교착(deadlock) 시: (1) 동일 SQL을 동시에 두 번 실행하지 말 것 (2) 잠시 후 1회 재시도
-- (3) 대시보드·앱 트래픽이 적은 시간에 실행 (4) Database → 기타 세션에서 긴 트랜잭션 종료.

begin;

select pg_advisory_xact_lock(849210331633101);

create or replace function public.session_email_from_auth_users()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(nullif(trim(coalesce(u.email::text, '')), ''))
  from auth.users u
  where u.id = auth.uid()
  limit 1;
$$;

comment on function public.session_email_from_auth_users() is
  '요청 세션 auth.uid() 의 auth.users 이메일 (DEFINER, RLS 보조).';

create or replace function public.is_staff_for_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff(public.session_email_from_auth_users());
$$;

create or replace function public.is_admin_user_for_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user(public.session_email_from_auth_users());
$$;

create or replace function public.is_team_member_for_session()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_team_member(public.session_email_from_auth_users());
$$;

create or replace function public.submitted_by_matches_session_auth_email(p_submitted_by text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(trim(coalesce(u.email::text, ''))) = lower(trim(coalesce(p_submitted_by, '')))
      and length(trim(coalesce(u.email::text, ''))) > 0
  );
$$;

comment on function public.submitted_by_matches_session_auth_email(text) is
  '입력 submitted_by 가 세션 사용자 auth.users 이메일과 일치하는지 (DEFINER).';

-- 멀티데이·미연결 분기: current_email() 실패 시에도 auth.users 경로로 통과
create or replace function public.ticket_booking_row_accessible(p_booking_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_booking_id is not null
  and exists (
    select 1
    from public.ticket_bookings tb
    where tb.id = p_booking_id
      and (
        public.is_staff()
        or public.is_staff_for_session()
        or public.is_admin_user(public.current_email())
        or public.is_admin_user_for_session()
        or public.is_team_member(public.current_email())
        or public.is_team_member_for_session()
        or (
          public.nullif_blank_tour_id(tb.tour_id) is not null
          and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tb.tour_id))
        )
        or (
          public.nullif_blank_tour_id(tb.tour_id) is null
          and (
            lower(trim(coalesce(tb.submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
            or public.submitted_by_matches_session_auth_email(tb.submitted_by)
          )
        )
      )
  );
$$;

drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
    or (
      public.nullif_blank_tour_id(tour_id) is null
      and (
        lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

drop policy if exists "ticket_bookings_update_accessible" on public.ticket_bookings;
create policy "ticket_bookings_update_accessible"
  on public.ticket_bookings for update to authenticated
  using (public.ticket_booking_row_accessible(id))
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_admin_user(public.current_email())
    or public.is_admin_user_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
    or (
      public.nullif_blank_tour_id(tour_id) is null
      and (
        lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
        or public.submitted_by_matches_session_auth_email(submitted_by)
      )
    )
  );

commit;
