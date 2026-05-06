-- ticket_booking_row_accessible / tour_hotel_booking_row_accessible were SECURITY INVOKER
-- and queried the same table that their RLS policies protect → infinite recursion → 500 on REST.
-- SECURITY DEFINER + locked search_path: owner read bypasses RLS; is_staff / current_email /
-- tour_expense_row_accessible_as_assignee still use JWT-backed helpers for authorization.

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
  'RLS: 티켓 부킹 행 — SECURITY DEFINER로 ticket_bookings RLS 자기참조 재귀 방지. 스태프/투어 배정/미연결+제출자.';

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
        or (
          hb.tour_id is not null
          and public.tour_expense_row_accessible_as_assignee(hb.tour_id)
        )
      )
  );
$$;

comment on function public.tour_hotel_booking_row_accessible(text) is
  'RLS: 호텔 부킹 행 — SECURITY DEFINER로 tour_hotel_bookings RLS 자기참조 재귀 방지. 스태프 또는 투어 배정.';

commit;
