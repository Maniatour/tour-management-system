-- ticket_bookings 일괄 추가 403 (office manager 등):
-- 1) is_staff() 가 team RLS 재귀·구버전 직책 화이트리스트(office_manager 누락)로 false
-- 2) is_booking_management_session_jwt_ok() 가 invoker 경로에서 team 을 못 읽음
-- customers INSERT 와 동일하게 DEFINER + customer_insert_team_role_ok 세션 경로를 ticket_bookings 에 반영.
--
-- Depends: session_email_from_auth_users (20260621160000), customer_insert_team_role_ok (20260621270000)

begin;

select pg_advisory_xact_lock(849210331633102);

-- ---------- team 읽기: RLS 재귀 방지 (21240000 재확인) ----------
create or replace function public.is_staff(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  if em in ('info@maniatour.com', 'wooyong.shim09@gmail.com') then
    return true;
  end if;
  return exists (
    select 1
    from public.team t
    where lower(t.email) = em
      and coalesce(t.is_active, true) = true
  );
end;
$$;

create or replace function public.is_admin_user(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
  pos text;
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  select lower(trim(coalesce(t.position::text, '')))
  into pos
  from public.team t
  where lower(t.email) = em
    and coalesce(t.is_active, true) = true
  limit 1;
  if pos is null then
    return false;
  end if;
  pos := lower(replace(pos, '_', ' '));
  return pos in (
    'super',
    'office manager',
    'admin',
    'manager',
    '매니저'
  );
end;
$$;

-- ---------- customers 와 동일한 office manager / op 직책 INSERT 헬퍼 (없으면 생성) ----------
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
  )
  or (
    length(trim(coalesce(auth.jwt() ->> 'email', ''))) > 0
    and public.customer_insert_team_role_ok(lower(trim(auth.jwt() ->> 'email')))
  );
$$;

-- ---------- 부킹 관리 직책: DEFINER + JWT email ----------
create or replace function public.is_booking_management_user(p_email text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  em text := lower(nullif(trim(coalesce(p_email, '')), ''));
  pos text;
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  select lower(trim(coalesce(t.position::text, '')))
  into pos
  from public.team t
  where lower(t.email) = em
    and coalesce(t.is_active, true) = true
  limit 1;
  if pos is null then
    return false;
  end if;
  pos := lower(replace(pos, '_', ' '));
  return pos in (
    'op',
    'office manager',
    'manager',
    '매니저',
    'super',
    'admin'
  );
end;
$$;

create or replace function public.is_booking_management_session_jwt_ok()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    public.is_booking_management_user(lower(nullif(trim(coalesce(public.current_email(), '')), '')))
    or public.is_booking_management_user(public.session_email_from_auth_users())
    or public.is_booking_management_user(lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '')))
    or public.customer_insert_team_role_ok();
$$;

-- ---------- ticket_booking_row_accessible: office manager SELECT(INSERT RETURNING) ----------
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
        (
          tb.deletion_requested_at is null
          and (
            public.is_staff()
            or public.is_staff_for_session()
            or public.is_admin_user(public.current_email())
            or public.is_admin_user_for_session()
            or public.is_team_member(public.current_email())
            or public.is_team_member_for_session()
            or public.is_booking_management_session_jwt_ok()
            or public.customer_insert_team_role_ok()
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
        )
        or (
          tb.deletion_requested_at is not null
          and public.is_super_booking_actor_session_jwt_ok()
        )
      )
  );
$$;

drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_booking_management_session_jwt_ok()
    or public.customer_insert_team_role_ok()
    or public.is_staff()
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
    (
      deletion_requested_at is null
      and (
        public.is_booking_management_session_jwt_ok()
        or public.customer_insert_team_role_ok()
        or public.is_staff()
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
      )
    )
    or (
      deletion_requested_at is not null
      and (
        public.is_super_booking_actor_session_jwt_ok()
        or public.is_booking_management_session_jwt_ok()
      )
    )
  );

commit;
