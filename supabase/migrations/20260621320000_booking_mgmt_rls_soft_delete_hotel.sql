-- 입장권/투어 호텔 부킹: op·office_manager·manager·super(및 admin) 전면 CRUD,
-- 삭제는 deletion_requested_* 소프트 삭제, 물리 DELETE 는 SUPER(및 화이트리스트)만.
-- tour_hotel_bookings 에 ticket 과 동일한 소프트 삭제 컬럼 추가.

begin;

-- ---------- tour_hotel_bookings: 소프트 삭제 컬럼 ----------
alter table public.tour_hotel_bookings
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by text;

comment on column public.tour_hotel_bookings.deletion_requested_at is
  '삭제 요청 시각 — 목록에서 숨김, SUPER 가 영구 삭제로 정리';
comment on column public.tour_hotel_bookings.deletion_requested_by is
  '삭제를 요청한 사용자 이메일';

create index if not exists idx_tour_hotel_bookings_deletion_requested_at
  on public.tour_hotel_bookings (deletion_requested_at)
  where deletion_requested_at is not null;

-- ---------- 헬퍼: SUPER 만 영구 삭제·삭제 대기 행 조회 ----------
create or replace function public.is_super_booking_actor(p_email text)
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
      and lower(trim(coalesce(t.position::text, ''))) = 'super'
  );
end;
$$;

comment on function public.is_super_booking_actor(text) is
  '부킹 영구 삭제 권한: 화이트리스트 이메일 또는 team position super (DEFINER).';

create or replace function public.is_super_booking_actor_session_jwt_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.is_super_booking_actor(lower(nullif(trim(coalesce(public.current_email(), '')), '')))
    or public.is_super_booking_actor(public.session_email_from_auth_users())
    or public.is_super_booking_actor(lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '')));
$$;

comment on function public.is_super_booking_actor_session_jwt_ok() is
  '부킹 SUPER 판별: current_email · session_email_from_auth_users · JWT email.';

-- ---------- 헬퍼: 부킹 관리 화면 전면 권한 직책 ----------
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
begin
  if em is null or length(em) = 0 then
    return false;
  end if;
  return exists (
    select 1
    from public.team t
    where lower(t.email) = em
      and coalesce(t.is_active, true) = true
      and lower(trim(coalesce(t.position::text, ''))) in (
        'op',
        'office_manager',
        'office manager',
        'manager',
        '매니저',
        'super',
        'admin'
      )
  );
end;
$$;

comment on function public.is_booking_management_user(text) is
  '입장권/호텔 부킹 관리 직책: op·office_manager·manager·super·admin 등 (DEFINER).';

create or replace function public.is_booking_management_session_jwt_ok()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.is_booking_management_user(lower(nullif(trim(coalesce(public.current_email(), '')), '')))
    or public.is_booking_management_user(public.session_email_from_auth_users())
    or public.is_booking_management_user(lower(nullif(trim(coalesce(auth.jwt() ->> 'email', '')), '')));
$$;

comment on function public.is_booking_management_session_jwt_ok() is
  '부킹 관리 직책: current_email · session · JWT.';

-- ---------- ticket_booking_row_accessible ----------
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

comment on function public.ticket_booking_row_accessible(text) is
  'RLS: 티켓 부킹 — 활성 행은 기존 경로+부킹관리직; 삭제요청 행은 SUPER만.';

-- ---------- tour_hotel_booking_row_accessible ----------
create or replace function public.tour_hotel_booking_row_accessible(p_booking_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_booking_id is not null
  and exists (
    select 1
    from public.tour_hotel_bookings hb
    where hb.id = p_booking_id
      and (
        (
          hb.deletion_requested_at is null
          and (
            public.is_staff()
            or public.is_staff_for_session()
            or public.is_admin_user(public.current_email())
            or public.is_admin_user_for_session()
            or public.is_team_member(public.current_email())
            or public.is_team_member_for_session()
            or public.is_booking_management_session_jwt_ok()
            or (
              public.nullif_blank_tour_id(hb.tour_id) is not null
              and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(hb.tour_id))
            )
          )
        )
        or (
          hb.deletion_requested_at is not null
          and public.is_super_booking_actor_session_jwt_ok()
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 — 활성 행은 기존+부킹관리직; 삭제요청 행은 SUPER만.';

-- ---------- ticket_bookings 정책 ----------
drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_booking_management_session_jwt_ok()
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

drop policy if exists "ticket_bookings_delete_accessible" on public.ticket_bookings;
drop policy if exists "ticket_bookings_delete_super_only" on public.ticket_bookings;
create policy "ticket_bookings_delete_super_only"
  on public.ticket_bookings for delete to authenticated
  using (public.is_super_booking_actor_session_jwt_ok());

-- ---------- tour_hotel_bookings 정책 ----------
drop policy if exists "tour_hotel_bookings_insert_accessible" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_insert_accessible"
  on public.tour_hotel_bookings for insert to authenticated
  with check (
    public.is_booking_management_session_jwt_ok()
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
  );

drop policy if exists "tour_hotel_bookings_update_accessible" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_update_accessible"
  on public.tour_hotel_bookings for update to authenticated
  using (public.tour_hotel_booking_row_accessible(id))
  with check (
    (
      deletion_requested_at is null
      and (
        public.is_booking_management_session_jwt_ok()
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

drop policy if exists "tour_hotel_bookings_delete_accessible" on public.tour_hotel_bookings;
drop policy if exists "tour_hotel_bookings_delete_super_only" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_delete_super_only"
  on public.tour_hotel_bookings for delete to authenticated
  using (public.is_super_booking_actor_session_jwt_ok());

commit;
