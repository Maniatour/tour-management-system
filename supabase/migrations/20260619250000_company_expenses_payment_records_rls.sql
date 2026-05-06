-- Step 13 (RLS hardening): company_expenses, payment_records
-- company_expenses: 기존 SELECT/INSERT/UPDATE/DELETE 가 USING(true)·WITH CHECK(true) 로 사실상 무제한.
-- payment_records: RLS 미설정 DB 대비 — 예약 입금 기록은 스태프 또는 해당 예약 투어 가이드/어시만.
-- Depends: public.is_staff(), public.reservation_expense_row_accessible_as_assignee (20260619120000).

begin;

-- ---------- company_expenses ----------
alter table public.company_expenses enable row level security;

-- 레거시 정책 + 동일 이름 재적용(멱등)
drop policy if exists "company_expenses_select_all" on public.company_expenses;
drop policy if exists "company_expenses_select_staff" on public.company_expenses;
drop policy if exists "company_expenses_insert_staff" on public.company_expenses;
drop policy if exists "company_expenses_update_staff" on public.company_expenses;
drop policy if exists "company_expenses_delete_staff" on public.company_expenses;

revoke all on table public.company_expenses from anon;
grant select, insert, update, delete on table public.company_expenses to authenticated;

create policy "company_expenses_select_staff"
  on public.company_expenses for select to authenticated
  using (public.is_staff());

create policy "company_expenses_insert_staff"
  on public.company_expenses for insert to authenticated
  with check (public.is_staff());

create policy "company_expenses_update_staff"
  on public.company_expenses for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "company_expenses_delete_staff"
  on public.company_expenses for delete to authenticated
  using (public.is_staff());

-- ---------- payment_records (테이블이 있는 프로젝트만) ----------
do $$
declare
  r record;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payment_records'
  ) then
    return;
  end if;

  execute 'alter table public.payment_records enable row level security';

  for r in
    select policyname as pname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_records'
  loop
    execute format('drop policy if exists %I on public.payment_records', r.pname);
  end loop;

  execute 'revoke all on table public.payment_records from anon';
  execute 'grant select, insert, update, delete on table public.payment_records to authenticated';

  execute $pol$
    create policy "payment_records_select_staff_or_assignee"
      on public.payment_records for select to authenticated
      using (
        public.is_staff()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
        or (
          reservation_id is not null
          and exists (
            select 1
            from public.reservations r
            inner join public.customers c on c.id = r.customer_id
            where r.id = reservation_id
              and lower(trim(coalesce(c.email, ''))) = lower(trim(coalesce(public.current_email(), '')))
          )
        )
      )
  $pol$;

  execute $pol$
    create policy "payment_records_insert_staff_or_assignee"
      on public.payment_records for insert to authenticated
      with check (
        public.is_staff()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
  $pol$;

  execute $pol$
    create policy "payment_records_update_staff_or_assignee"
      on public.payment_records for update to authenticated
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
      )
  $pol$;

  execute $pol$
    create policy "payment_records_delete_staff_or_assignee"
      on public.payment_records for delete to authenticated
      using (
        public.is_staff()
        or (
          reservation_id is not null
          and public.reservation_expense_row_accessible_as_assignee(reservation_id)
        )
      )
  $pol$;
end$$;

commit;
