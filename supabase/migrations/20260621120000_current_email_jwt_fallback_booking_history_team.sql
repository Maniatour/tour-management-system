-- PostgREST가 request.jwt.claim.* 만 채우지 않는 환경에서 current_email() 이 빈 문자열이 되어
-- ticket_bookings / booking_history RLS 가 전부 실패하는 경우가 있다.
-- auth.jwt() · user_metadata.email 까지 순차적으로 시도한다.
--
-- booking_history 트리거 INSERT 는 with_check 가 ticket_booking_row_accessible 에만 의존하지 않도록
-- is_staff / is_admin_user / is_team_member 경로를 명시해 이중으로 보장한다.

begin;

create or replace function public.current_email()
returns text
language sql
stable
set search_path = public
as $$
  select lower(nullif(trim(coalesce(
    nullif(trim(coalesce(auth.jwt() ->> 'email', '')), ''),
    nullif(trim(coalesce(auth.jwt() -> 'user_metadata' ->> 'email', '')), ''),
    nullif(trim(coalesce(current_setting('request.jwt.claim.email', true), '')), ''),
    nullif(trim(coalesce(
      (coalesce(
        nullif(trim(coalesce(current_setting('request.jwt.claims', true), '')), ''),
        '{}'
      ))::jsonb ->> 'email',
      ''
    )), ''),
    ''
  )), ''));
$$;

comment on function public.current_email() is
  'JWT 이메일: auth.jwt → user_metadata.email → request.jwt.claim.email → claims JSON (소문자·trim).';

drop policy if exists "booking_history_select_accessible" on public.booking_history;
create policy "booking_history_select_accessible"
  on public.booking_history for select to authenticated
  using (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

drop policy if exists "booking_history_insert_accessible" on public.booking_history;
create policy "booking_history_insert_accessible"
  on public.booking_history for insert to authenticated
  with check (
    public.is_staff()
    or public.is_admin_user(public.current_email())
    or public.is_team_member(public.current_email())
    or (
      booking_type = 'ticket'
      and public.ticket_booking_row_accessible(booking_id)
    )
    or (
      booking_type = 'hotel'
      and public.tour_hotel_booking_row_accessible(booking_id)
    )
  );

commit;
