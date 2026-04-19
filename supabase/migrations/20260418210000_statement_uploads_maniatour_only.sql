-- 명세 업로드(가져오기) 본문: statement_imports / statement_lines INSERT·삭제·헤더 수정은
-- info@maniatour.com 만 가능. 대조(매칭)는 reconciliation_matches 및 statement_lines UPDATE로 처리되므로
-- 기존 UPDATE 정책은 유지합니다.

begin;

-- statement_imports: 업로드·잠금·삭제 등
drop policy if exists "statement_imports_insert_staff" on public.statement_imports;
drop policy if exists "statement_imports_update_staff" on public.statement_imports;
drop policy if exists "statement_imports_delete_staff" on public.statement_imports;

create policy "statement_imports_insert_maniatour"
  on public.statement_imports for insert to authenticated
  with check (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com');

create policy "statement_imports_update_maniatour"
  on public.statement_imports for update to authenticated
  using (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com')
  with check (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com');

create policy "statement_imports_delete_maniatour"
  on public.statement_imports for delete to authenticated
  using (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com');

-- statement_lines: CSV로 들어가는 행 삽입만 제한 (UPDATE는 대조용으로 전 직원)
drop policy if exists "statement_lines_insert_staff" on public.statement_lines;

create policy "statement_lines_insert_maniatour"
  on public.statement_lines for insert to authenticated
  with check (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com');

-- (선택) 명세 행 자체 삭제는 업로드 관리자만
drop policy if exists "statement_lines_delete_staff" on public.statement_lines;

create policy "statement_lines_delete_maniatour"
  on public.statement_lines for delete to authenticated
  using (lower(trim(auth.jwt() ->> 'email')) = 'info@maniatour.com');

commit;
