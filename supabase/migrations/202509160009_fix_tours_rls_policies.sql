-- Fix tours RLS policies to allow all operations for data sync
-- This allows data sync to work without RLS restrictions

begin;

-- 기존 정책 삭제
drop policy if exists "tours_insert_staff" on public.tours;
drop policy if exists "tours_update_staff" on public.tours;
drop policy if exists "tours_delete_staff" on public.tours;
drop policy if exists "tours_select_assigned_or_staff" on public.tours;

-- 새로운 정책 생성 (모든 작업 허용)
create policy "tours_insert_all" on public.tours
  for insert
  with check (true);

create policy "tours_update_all" on public.tours
  for update
  using (true)
  with check (true);

create policy "tours_delete_all" on public.tours
  for delete
  using (true);

create policy "tours_select_all" on public.tours
  for select
  using (true);

commit;
