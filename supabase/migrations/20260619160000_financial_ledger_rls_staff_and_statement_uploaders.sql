-- Step 5 (RLS hardening): financial_accounts, statement_imports, statement_lines,
--   reconciliation_matches, journal_entries, journal_lines
-- Replaces USING(true) / WITH CHECK(true) (any caller with table GRANT = full access).
-- Read: active team staff (is_staff). Statement import/line delete: super or info@maniatour.com (기존 maniatour 정책과 동일).
-- statement_lines UPDATE: 전 스태프(대조 UI).

begin;

create or replace function public.statement_csv_upload_privileged()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select lower(trim(coalesce(public.current_email(), ''))) = 'info@maniatour.com'
  or exists (
    select 1
    from public.team t
    where lower(t.email) = public.current_email()
      and coalesce(t.is_active, true) = true
      and lower(coalesce(t.position::text, '')) = 'super'
  );
$$;

comment on function public.statement_csv_upload_privileged() is
  '명세 CSV 가져오기(statement_imports / statement_lines insert·import 삭제): Super 또는 info@maniatour.com';

-- ---- financial_accounts ----
drop policy if exists "financial_accounts_select_all" on public.financial_accounts;
drop policy if exists "financial_accounts_insert_staff" on public.financial_accounts;
drop policy if exists "financial_accounts_update_staff" on public.financial_accounts;
drop policy if exists "financial_accounts_delete_staff" on public.financial_accounts;

revoke all on table public.financial_accounts from anon;

create policy "financial_accounts_select_staff"
  on public.financial_accounts for select to authenticated
  using (public.is_staff());

create policy "financial_accounts_insert_staff"
  on public.financial_accounts for insert to authenticated
  with check (public.is_staff());

create policy "financial_accounts_update_staff"
  on public.financial_accounts for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "financial_accounts_delete_staff"
  on public.financial_accounts for delete to authenticated
  using (public.is_staff());

-- ---- statement_imports ----
drop policy if exists "statement_imports_select_all" on public.statement_imports;
drop policy if exists "statement_imports_insert_staff" on public.statement_imports;
drop policy if exists "statement_imports_update_staff" on public.statement_imports;
drop policy if exists "statement_imports_delete_staff" on public.statement_imports;
drop policy if exists "statement_imports_insert_maniatour" on public.statement_imports;
drop policy if exists "statement_imports_update_maniatour" on public.statement_imports;
drop policy if exists "statement_imports_delete_maniatour" on public.statement_imports;

revoke all on table public.statement_imports from anon;

create policy "statement_imports_select_staff"
  on public.statement_imports for select to authenticated
  using (public.is_staff());

create policy "statement_imports_insert_uploaders"
  on public.statement_imports for insert to authenticated
  with check (public.statement_csv_upload_privileged());

create policy "statement_imports_update_uploaders"
  on public.statement_imports for update to authenticated
  using (public.statement_csv_upload_privileged())
  with check (public.statement_csv_upload_privileged());

create policy "statement_imports_delete_uploaders"
  on public.statement_imports for delete to authenticated
  using (public.statement_csv_upload_privileged());

-- ---- statement_lines ----
drop policy if exists "statement_lines_select_all" on public.statement_lines;
drop policy if exists "statement_lines_insert_staff" on public.statement_lines;
drop policy if exists "statement_lines_update_staff" on public.statement_lines;
drop policy if exists "statement_lines_delete_staff" on public.statement_lines;
drop policy if exists "statement_lines_insert_maniatour" on public.statement_lines;
drop policy if exists "statement_lines_delete_maniatour" on public.statement_lines;

revoke all on table public.statement_lines from anon;

create policy "statement_lines_select_staff"
  on public.statement_lines for select to authenticated
  using (public.is_staff());

create policy "statement_lines_insert_uploaders"
  on public.statement_lines for insert to authenticated
  with check (public.statement_csv_upload_privileged());

create policy "statement_lines_update_staff"
  on public.statement_lines for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "statement_lines_delete_uploaders"
  on public.statement_lines for delete to authenticated
  using (public.statement_csv_upload_privileged());

-- ---- reconciliation_matches ----
drop policy if exists "reconciliation_matches_select_all" on public.reconciliation_matches;
drop policy if exists "reconciliation_matches_insert_staff" on public.reconciliation_matches;
drop policy if exists "reconciliation_matches_update_staff" on public.reconciliation_matches;
drop policy if exists "reconciliation_matches_delete_staff" on public.reconciliation_matches;

revoke all on table public.reconciliation_matches from anon;

create policy "reconciliation_matches_select_staff"
  on public.reconciliation_matches for select to authenticated
  using (public.is_staff());

create policy "reconciliation_matches_insert_staff"
  on public.reconciliation_matches for insert to authenticated
  with check (public.is_staff());

create policy "reconciliation_matches_update_staff"
  on public.reconciliation_matches for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "reconciliation_matches_delete_staff"
  on public.reconciliation_matches for delete to authenticated
  using (public.is_staff());

-- ---- journal_entries / journal_lines (GRANT 누락 환경 대비) ----
grant select, insert, update, delete on table public.journal_entries to authenticated, service_role;
grant select, insert, update, delete on table public.journal_lines to authenticated, service_role;

drop policy if exists "journal_entries_select_all" on public.journal_entries;
drop policy if exists "journal_entries_insert_staff" on public.journal_entries;
drop policy if exists "journal_entries_update_staff" on public.journal_entries;
drop policy if exists "journal_entries_delete_staff" on public.journal_entries;

revoke all on table public.journal_entries from anon;

create policy "journal_entries_select_staff"
  on public.journal_entries for select to authenticated
  using (public.is_staff());

create policy "journal_entries_insert_staff"
  on public.journal_entries for insert to authenticated
  with check (public.is_staff());

create policy "journal_entries_update_staff"
  on public.journal_entries for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "journal_entries_delete_staff"
  on public.journal_entries for delete to authenticated
  using (public.is_staff());

drop policy if exists "journal_lines_select_all" on public.journal_lines;
drop policy if exists "journal_lines_insert_staff" on public.journal_lines;
drop policy if exists "journal_lines_update_staff" on public.journal_lines;
drop policy if exists "journal_lines_delete_staff" on public.journal_lines;

revoke all on table public.journal_lines from anon;

create policy "journal_lines_select_staff"
  on public.journal_lines for select to authenticated
  using (public.is_staff());

create policy "journal_lines_insert_staff"
  on public.journal_lines for insert to authenticated
  with check (public.is_staff());

create policy "journal_lines_update_staff"
  on public.journal_lines for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy "journal_lines_delete_staff"
  on public.journal_lines for delete to authenticated
  using (public.is_staff());

commit;
