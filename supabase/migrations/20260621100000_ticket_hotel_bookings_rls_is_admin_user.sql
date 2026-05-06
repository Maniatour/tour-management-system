-- Office Manager·Super 등이 public.is_staff() 정의가 배포 DB와 어긋난 경우에도
-- 입장권/호텔 부킹 INSERT·UPDATE·SELECT(RETURNING)·히스토리 트리거가 통과하도록
-- is_admin_user(current_email) 경로를 추가한다.
-- Depends: public.is_admin_user(text), public.current_email().

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
  'RLS: 티켓 부킹 — SECURITY DEFINER. 스태프·관리자(super/office manager/admin/manager)·투어 배정·미연결+제출자.';

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
        or (
          hb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(hb.tour_id)
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 — SECURITY DEFINER. 스태프·관리자 또는 투어 배정.';

drop policy if exists "ticket_bookings_insert_accessible" on public.ticket_bookings;
create policy "ticket_bookings_insert_accessible"
  on public.ticket_bookings for insert to authenticated
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
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
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

commit;
