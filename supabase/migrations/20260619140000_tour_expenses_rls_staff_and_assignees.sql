-- Step 3 (RLS hardening): tour_expenses
-- Replaces permissive policies (USING true on SELECT / open DML from 202509160015).
-- Staff: full access. Guide/assistant on the tour: read all rows for that tour; write own submitted_by only.
-- Sync continues to use service_role (bypasses RLS).

begin;

create or replace function public.tour_expense_row_accessible_as_assignee(p_tour_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select p_tour_id is not null
  and exists (
    select 1
    from public.tours t
    where t.id = p_tour_id
      and (
        lower(coalesce(t.tour_guide_id, '')) = public.current_email()
        or lower(coalesce(t.assistant_id, '')) = public.current_email()
      )
  );
$$;

comment on function public.tour_expense_row_accessible_as_assignee(text) is
  'RLS helper: JWT 사용자가 해당 투어의 가이드 또는 어시스턴트인지 여부';

drop policy if exists "tour_expenses_select_all" on public.tour_expenses;
drop policy if exists "tour_expenses_insert_all" on public.tour_expenses;
drop policy if exists "tour_expenses_update_all" on public.tour_expenses;
drop policy if exists "tour_expenses_delete_all" on public.tour_expenses;
drop policy if exists "tour_expenses_insert_staff" on public.tour_expenses;
drop policy if exists "tour_expenses_update_staff" on public.tour_expenses;
drop policy if exists "tour_expenses_delete_staff" on public.tour_expenses;

revoke all on table public.tour_expenses from anon;

create policy "tour_expenses_select_staff_or_assignee"
  on public.tour_expenses
  for select
  to authenticated
  using (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_expenses_insert_staff_or_assignee_own"
  on public.tour_expenses
  for insert
  to authenticated
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

create policy "tour_expenses_update_staff_or_assignee_own"
  on public.tour_expenses
  for update
  to authenticated
  using (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  )
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

create policy "tour_expenses_delete_staff_or_assignee_own"
  on public.tour_expenses
  for delete
  to authenticated
  using (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
      and lower(trim(submitted_by)) = public.current_email()
    )
  );

commit;
