-- Step 10 (RLS hardening): statement_expense_autofill_rules, employee_hourly_rate_periods,
--   position_hourly_rate_periods, reservation_follow_ups, reservation_follow_up_pipeline_manual, tour_bonuses
-- Depends: public.is_staff(), public.current_email(), public.reservation_expense_row_accessible_as_assignee,
--   public.tour_expense_row_accessible_as_assignee (191200, 191400).

begin;

-- ---------- statement_expense_autofill_rules ----------
alter table public.statement_expense_autofill_rules enable row level security;

drop policy if exists "statement_expense_autofill_rules_select" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_insert" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_update" on public.statement_expense_autofill_rules;
drop policy if exists "statement_expense_autofill_rules_delete" on public.statement_expense_autofill_rules;

revoke all on table public.statement_expense_autofill_rules from anon;
grant select, insert, update, delete on table public.statement_expense_autofill_rules to authenticated;

create policy "statement_expense_autofill_rules_select_staff"
  on public.statement_expense_autofill_rules for select to authenticated
  using (public.is_staff());

create policy "statement_expense_autofill_rules_insert_staff"
  on public.statement_expense_autofill_rules for insert to authenticated
  with check (public.is_staff());

create policy "statement_expense_autofill_rules_update_staff"
  on public.statement_expense_autofill_rules for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "statement_expense_autofill_rules_delete_staff"
  on public.statement_expense_autofill_rules for delete to authenticated
  using (public.is_staff());

-- ---------- employee_hourly_rate_periods ----------
alter table public.employee_hourly_rate_periods enable row level security;

drop policy if exists "employee_hourly_rate_periods_all" on public.employee_hourly_rate_periods;

revoke all on table public.employee_hourly_rate_periods from anon;
grant select, insert, update, delete on table public.employee_hourly_rate_periods to authenticated;

create policy "employee_hourly_rate_periods_select_staff"
  on public.employee_hourly_rate_periods for select to authenticated
  using (public.is_staff());

create policy "employee_hourly_rate_periods_insert_staff"
  on public.employee_hourly_rate_periods for insert to authenticated
  with check (public.is_staff());

create policy "employee_hourly_rate_periods_update_staff"
  on public.employee_hourly_rate_periods for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "employee_hourly_rate_periods_delete_staff"
  on public.employee_hourly_rate_periods for delete to authenticated
  using (public.is_staff());

-- ---------- position_hourly_rate_periods ----------
alter table public.position_hourly_rate_periods enable row level security;

drop policy if exists "position_hourly_rate_periods_all" on public.position_hourly_rate_periods;

revoke all on table public.position_hourly_rate_periods from anon;
grant select, insert, update, delete on table public.position_hourly_rate_periods to authenticated;

create policy "position_hourly_rate_periods_select_staff"
  on public.position_hourly_rate_periods for select to authenticated
  using (public.is_staff());

create policy "position_hourly_rate_periods_insert_staff"
  on public.position_hourly_rate_periods for insert to authenticated
  with check (public.is_staff());

create policy "position_hourly_rate_periods_update_staff"
  on public.position_hourly_rate_periods for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "position_hourly_rate_periods_delete_staff"
  on public.position_hourly_rate_periods for delete to authenticated
  using (public.is_staff());

-- ---------- reservation_follow_ups ----------
alter table public.reservation_follow_ups enable row level security;

drop policy if exists "Allow all access to reservation_follow_ups" on public.reservation_follow_ups;

revoke all on table public.reservation_follow_ups from anon;
grant select, insert, update, delete on table public.reservation_follow_ups to authenticated;

create policy "reservation_follow_ups_select_staff_or_assignee"
  on public.reservation_follow_ups for select to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_ups_insert_staff_or_assignee"
  on public.reservation_follow_ups for insert to authenticated
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_ups_update_staff_or_assignee"
  on public.reservation_follow_ups for update to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_ups_delete_staff"
  on public.reservation_follow_ups for delete to authenticated
  using (public.is_staff());

-- ---------- reservation_follow_up_pipeline_manual ----------
alter table public.reservation_follow_up_pipeline_manual enable row level security;

drop policy if exists "Allow all access to reservation_follow_up_pipeline_manual"
  on public.reservation_follow_up_pipeline_manual;

revoke all on table public.reservation_follow_up_pipeline_manual from anon;
grant select, insert, update, delete on table public.reservation_follow_up_pipeline_manual to authenticated;

create policy "reservation_follow_up_pipeline_manual_select_staff_or_assignee"
  on public.reservation_follow_up_pipeline_manual for select to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_up_pipeline_manual_insert_staff_or_assignee"
  on public.reservation_follow_up_pipeline_manual for insert to authenticated
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_up_pipeline_manual_update_staff_or_assignee"
  on public.reservation_follow_up_pipeline_manual for update to authenticated
  using (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  )
  with check (
    public.is_staff()
    or (
      reservation_id is not null
      and public.reservation_expense_row_accessible_as_assignee(reservation_id)
    )
  );

create policy "reservation_follow_up_pipeline_manual_delete_staff"
  on public.reservation_follow_up_pipeline_manual for delete to authenticated
  using (public.is_staff());

-- ---------- tour_bonuses ----------
alter table public.tour_bonuses enable row level security;

drop policy if exists "Allow all access to tour_bonuses" on public.tour_bonuses;

revoke all on table public.tour_bonuses from anon;
grant select, insert, update, delete on table public.tour_bonuses to authenticated;

create policy "tour_bonuses_select_staff_or_assignee"
  on public.tour_bonuses for select to authenticated
  using (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_bonuses_insert_staff_or_assignee"
  on public.tour_bonuses for insert to authenticated
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_bonuses_update_staff_or_assignee"
  on public.tour_bonuses for update to authenticated
  using (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  )
  with check (
    public.is_staff()
    or (
      tour_id is not null
      and public.tour_expense_row_accessible_as_assignee(tour_id)
    )
  );

create policy "tour_bonuses_delete_staff"
  on public.tour_bonuses for delete to authenticated
  using (public.is_staff());

commit;
