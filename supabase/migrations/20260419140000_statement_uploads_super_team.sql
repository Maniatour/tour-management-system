-- 명세 CSV 업로드: info@maniatour.com 또는 team.position = super (활성) 직원 허용

begin;

drop policy if exists "statement_imports_insert_maniatour" on public.statement_imports;
drop policy if exists "statement_imports_update_maniatour" on public.statement_imports;
drop policy if exists "statement_imports_delete_maniatour" on public.statement_imports;
drop policy if exists "statement_lines_insert_maniatour" on public.statement_lines;
drop policy if exists "statement_lines_delete_maniatour" on public.statement_lines;

create policy "statement_imports_insert_maniatour"
  on public.statement_imports for insert to authenticated
  with check (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  );

create policy "statement_imports_update_maniatour"
  on public.statement_imports for update to authenticated
  using (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  )
  with check (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  );

create policy "statement_imports_delete_maniatour"
  on public.statement_imports for delete to authenticated
  using (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  );

create policy "statement_lines_insert_maniatour"
  on public.statement_lines for insert to authenticated
  with check (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  );

create policy "statement_lines_delete_maniatour"
  on public.statement_lines for delete to authenticated
  using (
    lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com'
    or exists (
      select 1
      from public.team t
      where lower(t.email) = lower(trim(auth.jwt() ->> 'email'))
        and t.is_active = true
        and lower(coalesce(t.position::text, '')) = 'super'
    )
  );

commit;
