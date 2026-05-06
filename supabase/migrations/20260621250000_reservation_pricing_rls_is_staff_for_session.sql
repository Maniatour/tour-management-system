-- 1) reservation_pricing: 쓰기·조회에 is_staff_for_session() 추가
--    (JWT email 비어 current_email() 실패 시 reservations 는 통과해도 가격 INSERT 가 42501)
-- 2) audit_logs: reservations INSERT 트리거가 감사 행을 넣을 때
--    audit_logs_insert_team 이 current_email() 만 쓰면 전체 예약 INSERT 가 롤백될 수 있음
--
-- Depends: is_staff_for_session, is_team_member_for_session, session_email_from_auth_users (20260621160000),
--          reservation_pricing RLS (20260619130000), audit_logs (20260619260000)

begin;

drop policy if exists "reservation_pricing_select_staff_or_assignee" on public.reservation_pricing;
drop policy if exists "reservation_pricing_insert_staff" on public.reservation_pricing;
drop policy if exists "reservation_pricing_update_staff" on public.reservation_pricing;
drop policy if exists "reservation_pricing_delete_staff" on public.reservation_pricing;

create policy "reservation_pricing_select_staff_or_assignee"
  on public.reservation_pricing
  for select
  to authenticated
  using (
    public.is_staff()
    or public.is_staff_for_session()
    or public.reservation_expense_row_accessible_as_assignee(reservation_id)
  );

create policy "reservation_pricing_insert_staff"
  on public.reservation_pricing
  for insert
  to authenticated
  with check (public.is_staff() or public.is_staff_for_session());

create policy "reservation_pricing_update_staff"
  on public.reservation_pricing
  for update
  to authenticated
  using (public.is_staff() or public.is_staff_for_session())
  with check (public.is_staff() or public.is_staff_for_session());

create policy "reservation_pricing_delete_staff"
  on public.reservation_pricing
  for delete
  to authenticated
  using (public.is_staff() or public.is_staff_for_session());

drop policy if exists "audit_logs_insert_team" on public.audit_logs;

create policy "audit_logs_insert_team"
  on public.audit_logs for insert to authenticated
  with check (
    public.is_staff()
    or public.is_staff_for_session()
    or public.is_team_member(public.current_email())
    or public.is_team_member_for_session()
    or public.is_team_member(public.session_email_from_auth_users())
  );

commit;
