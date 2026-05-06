-- ticket_bookings.tour_id 가 NULL 이 아니라 빈 문자열('')로 들어오면
-- `tour_id is not null` 분기로 잡혀 assignee 체크가 실패하고, 미연결+submitted_by 분기에 못 들어간다.
-- 앱/PostgREST 모두에서 '' 를 투어 미연결과 동일하게 본다.

begin;

create or replace function public.nullif_blank_tour_id(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(btrim(coalesce(p, '')), '');
$$;

comment on function public.nullif_blank_tour_id(text) is
  '투어 ID: 공백·빈 문자열이면 NULL 로 정규화 (RLS 미연결 분기용).';

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
        or public.is_admin_user(public.current_email())
        or public.is_team_member(public.current_email())
        or (
          public.nullif_blank_tour_id(tb.tour_id) is not null
          and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tb.tour_id))
        )
        or (
          public.nullif_blank_tour_id(tb.tour_id) is null
          and lower(trim(coalesce(tb.submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
        )
      )
  );
$$;

comment on function public.ticket_booking_row_accessible(text) is
  'RLS: 티켓 부킹 — 스태프·관리자·팀원·투어 배정·미연결(빈 tour_id 포함)+제출자.';

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
        public.is_staff()
        or public.is_admin_user(public.current_email())
        or public.is_team_member(public.current_email())
        or (
          public.nullif_blank_tour_id(hb.tour_id) is not null
          and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(hb.tour_id))
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 — 스태프·관리자·팀원 또는 투어 배정 (빈 tour_id 는 미연결).';

drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
    or (
      public.nullif_blank_tour_id(tour_id) is null
      and lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
    )
  );

drop policy if exists "ticket_bookings_update_accessible" on public.ticket_bookings;
create policy "ticket_bookings_update_accessible"
  on public.ticket_bookings for update to authenticated
  using (public.ticket_booking_row_accessible(id))
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
    or (
      public.nullif_blank_tour_id(tour_id) is null
      and lower(trim(coalesce(submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
    )
  );

drop policy if exists "tour_hotel_bookings_insert_accessible" on public.tour_hotel_bookings;
create policy "tour_hotel_bookings_insert_accessible"
  on public.tour_hotel_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
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
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      public.nullif_blank_tour_id(tour_id) is not null
      and public.tour_expense_row_accessible_as_assignee(public.nullif_blank_tour_id(tour_id))
    )
  );

commit;
