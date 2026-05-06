-- 입장권/호텔 부킹: 활성 team 행만 있는 사용자(OP·드라이버 등)는 is_staff / is_admin_user 에
-- 안 걸려도 사내 도구에서 저장해야 함. ticket_booking_row_accessible 에 team 멤버 경로를 넣어
-- INSERT·RETURNING·booking_history 트리거·자식 테이블 RLS 가 한 트랜잭션으로 통과한다.
-- Depends: public.is_team_member(text), public.current_email().

begin;

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
          tb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(tb.tour_id)
        )
        or (
          tb.tour_id is null
          and lower(trim(coalesce(tb.submitted_by, ''))) = lower(trim(coalesce(public.current_email(), '')))
        )
      )
  );
$$;

comment on function public.ticket_booking_row_accessible(text) is
  'RLS: 티켓 부킹 — SECURITY DEFINER. 스태프·관리자·팀원·투어 배정·미연결+제출자.';

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
          hb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(hb.tour_id)
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 — SECURITY DEFINER. 스태프·관리자·팀원 또는 투어 배정.';

drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
    or (
      tour_id is null
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
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
    or (
      tour_id is null
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
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
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
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

commit;
