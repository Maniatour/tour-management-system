-- Step 1 (RLS hardening): reservation_expenses
-- Replace permissive policies (USING true) with staff + tour assignee scope.
-- Service role continues to bypass RLS (server routes must still enforce auth separately).

begin;

-- 가이드/어시스턴트가 해당 예약의 투어에 배정된 경우에만 예약 지출 행에 접근 가능
create or replace function public.reservation_expense_row_accessible_as_assignee(p_reservation_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_reservation_id is not null
  and exists (
    select 1
    from public.reservations r
    inner join public.tours t on t.id = r.tour_id
    where r.id = p_reservation_id
      and (
        lower(coalesce(t.tour_guide_id, '')) = public.current_email()
        or lower(coalesce(t.assistant_id, '')) = public.current_email()
      )
  );
$$;

comment on function public.reservation_expense_row_accessible_as_assignee(text) is
  'RLS helper: JWT 사용자가 해당 예약 투어의 가이드 또는 어시스턴트인지 여부';

drop policy if exists "reservation_expenses_select_all" on public.reservation_expenses;
drop policy if exists "reservation_expenses_insert_staff" on public.reservation_expenses;
drop policy if exists "reservation_expenses_update_staff" on public.reservation_expenses;
drop policy if exists "reservation_expenses_delete_staff" on public.reservation_expenses;

-- 익명 클라이언트(anon)는 직접 접근 불가 (앱은 authenticated JWT 또는 service role 사용)
revoke all on table public.reservation_expenses from anon;

create policy "reservation_expenses_select_staff_or_assignee"
  on public.reservation_expenses
  for select
  to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

-- 스태프: 전 행 / 가이드·어시스턴트: 본인이 제출한(submitted_by) 행만, 해당 예약이 자신 투어에 속할 때
create policy "reservation_expenses_insert_staff_or_assignee_own"
  on public.reservation_expenses
  for insert
  to authenticated
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

create policy "reservation_expenses_update_staff_or_assignee_own"
  on public.reservation_expenses
  for update
  to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  )
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

create policy "reservation_expenses_delete_staff_or_assignee_own"
  on public.reservation_expenses
  for delete
  to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

commit;
